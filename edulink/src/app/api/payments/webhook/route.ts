import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getClient, query } from '@/lib/db';

type TransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  meta: { subscription_id?: string; walletCredited?: boolean } | null;
};

function normalizePaymentStatus(raw: unknown): 'success' | 'failed' | 'pending' {
  const value = String(raw ?? '').toLowerCase();
  if (!value) return 'pending';
  if (value.includes('success') || value.includes('complete') || value.includes('paid')) return 'success';
  if (value.includes('fail') || value.includes('cancel') || value.includes('declin') || value.includes('revers')) return 'failed';
  return 'pending';
}

export async function POST(req: Request) {
  const raw = await req.text();
  // Log all headers for debugging
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => { headersObj[key as string] = value; });
  console.log('[WEBHOOK] All headers:', headersObj);
  const signature = req.headers.get('x-lipana-signature');
  const webhookSecret = process.env.LIPANA_WEBHOOK_SECRET;
  // Log raw body and signature
  console.log('[WEBHOOK] Raw payload:', raw);
  console.log('[WEBHOOK] Signature:', signature);

  if (webhookSecret && signature) {
    const expected = createHmac('sha256', webhookSecret).update(raw).digest('hex');
    const normalizedSignature = signature.includes('=') ? signature.split('=').pop()?.trim() ?? '' : signature.trim();
    const providedBuffer = Buffer.from(normalizedSignature);
    const expectedBuffer = Buffer.from(expected);
    const valid =
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer);
    if (!valid) {
      console.error('[WEBHOOK] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: Record<string, any> = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    console.error('[WEBHOOK] Invalid JSON payload');
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  const event = payload?.event;
  const data = payload?.data ?? {};
  const eventStatus = String(event ?? '').toLowerCase();
  const candidateStatus =
    data?.status ??
    data?.transactionStatus ??
    data?.paymentStatus ??
    data?.state ??
    payload?.status ??
    payload?.state ??
    event;
  const resultCode = String(data?.resultCode ?? data?.result_code ?? payload?.resultCode ?? '').toLowerCase();
  let status = normalizePaymentStatus(candidateStatus);
  if (status !== 'success') {
    const successByEvent = eventStatus.includes('success') || eventStatus.includes('completed') || eventStatus.includes('paid');
    const successByCode = resultCode === '0' || resultCode === 'success' || resultCode === 'completed';
    if (successByEvent || successByCode) {
      status = 'success';
    }
  }
  const transactionId =
    data?.transactionId ??
    data?.transaction_id ??
    data?.checkoutRequestId ??
    data?.merchantRequestId ??
    data?.reference ??
    data?.id ??
    payload?.transactionId ??
    payload?.transaction_id ??
    payload?.reference ??
    payload?.id;

  // LOG: Decoded payload and transactionId
  console.log('[WEBHOOK] Decoded payload:', payload);
  console.log('[WEBHOOK] TransactionId:', transactionId);

  if (!transactionId) {
    console.error('[WEBHOOK] Invalid payload: missing transactionId');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { rows: txnRows } = await query<TransactionRow>(
    `select id, user_id, type, amount, status, meta
     from transactions
     where reference = $1
        or meta->'data'->>'transactionId' = $1
        or meta->'data'->>'transaction_id' = $1
        or meta->'data'->>'checkoutRequestId' = $1
        or meta->'data'->>'merchantRequestId' = $1
        or meta->'data'->>'reference' = $1
        or meta->'data'->>'id' = $1
     order by created_at desc
     limit 1`,
    [transactionId]
  );
  const txn = txnRows[0];
  if (!txn) {
    console.warn('[WEBHOOK] No transaction found for reference:', transactionId);
    return NextResponse.json({ ok: true });
  }

  const previousStatus = normalizePaymentStatus(txn.status);
  const wasSuccess = previousStatus === 'success';
  const wasCredited = txn.meta?.walletCredited === true;
  const shouldCredit = status === 'success' && !wasCredited;

  const shouldPersistStatus =
    (previousStatus === 'pending' && status !== 'pending') ||
    (previousStatus === 'failed' && status === 'success') ||
    (previousStatus === 'pending' && status === 'pending');

  if (shouldPersistStatus && status !== previousStatus) {
    await query('update transactions set status = $1 where id = $2', [status, txn.id]);
    console.log('[WEBHOOK] Transaction status updated:', txn.id, status);
  }

  if (shouldCredit) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows: lockRows } = await client.query<TransactionRow>(
        'select id, user_id, type, amount, status, meta from transactions where id = $1 for update',
        [txn.id]
      );
      const lockedTxn = lockRows[0];
      if (!lockedTxn) {
        throw new Error('Transaction not found during reconciliation');
      }

      const alreadyCredited = lockedTxn.meta?.walletCredited === true;
      if (alreadyCredited) {
        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      }

      const walletRes = await client.query('select * from wallets where user_id = $1', [txn.user_id]);
      const wallet = walletRes.rows[0];
      const newBal = Number(wallet?.balance ?? 0) + Number(lockedTxn.amount ?? 0);
      if (lockedTxn.type === 'topup') {
        if (wallet) {
          await client.query(
            'update wallets set balance = $1, currency = $2, updated_at = now() where user_id = $3',
            [newBal, wallet?.currency ?? 'KES', lockedTxn.user_id]
          );
        } else {
          await client.query(
            'insert into wallets (user_id, balance, currency) values ($1, $2, $3)',
            [lockedTxn.user_id, newBal, 'KES']
          );
        }
        console.log('[WEBHOOK] Wallet updated:', lockedTxn.user_id, newBal);
      }
      if (lockedTxn.type === 'subscription' && lockedTxn.meta?.subscription_id) {
        await client.query(
          'update subscriptions set active = true, starts_at = now() where id = $1',
          [lockedTxn.meta.subscription_id]
        );
        console.log('[WEBHOOK] Subscription activated:', lockedTxn.meta.subscription_id);
      }

      await client.query(
        `update transactions
         set meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{walletCredited}', 'true'::jsonb, true),
             status = 'success'
         where id = $1`,
        [lockedTxn.id]
      );

      await client.query('COMMIT');
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      console.error('[WEBHOOK] Wallet/subscription update error:', err);
      return NextResponse.json({ error: 'Webhook reconciliation failed' }, { status: 500 });
    } finally {
      client.release();
    }
  }
  return NextResponse.json({ ok: true });
}
