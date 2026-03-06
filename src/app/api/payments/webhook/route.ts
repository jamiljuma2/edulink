import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { getClient, query } from '@/lib/db';

type TransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  meta: { subscription_id?: string } | null;
};

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
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) {
      console.error('[WEBHOOK] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  const payload = raw ? JSON.parse(raw) : {};
  const event = payload?.event;
  const data = payload?.data ?? {};
  const rawStatus = String(data?.status ?? '').toLowerCase();
  const eventStatus = String(event ?? '').toLowerCase();
  const isSuccess =
    rawStatus.includes('success') ||
    rawStatus.includes('completed') ||
    eventStatus.includes('success') ||
    eventStatus.includes('completed');
  const status = isSuccess ? 'success' : rawStatus || 'pending';
  const transactionId = data?.transactionId ?? data?.transaction_id;

  // LOG: Decoded payload and transactionId
  console.log('[WEBHOOK] Decoded payload:', payload);
  console.log('[WEBHOOK] TransactionId:', transactionId);

  if (!transactionId) {
    console.error('[WEBHOOK] Invalid payload: missing transactionId');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { rows: txnRows } = await query<TransactionRow>(
    'select id, user_id, type, amount, status, meta from transactions where reference = $1',
    [transactionId]
  );
  const txn = txnRows[0];
  if (!txn) {
    console.warn('[WEBHOOK] No transaction found for reference:', transactionId);
    return NextResponse.json({ ok: true });
  }

  const wasSuccess = String(txn.status ?? '').toLowerCase() === 'success';
  const shouldCredit = status === 'success' && !wasSuccess;

  if (!wasSuccess || status !== txn.status) {
    await query('update transactions set status = $1 where id = $2', [status, txn.id]);
    console.log('[WEBHOOK] Transaction status updated:', txn.id, status);
  }

  if (shouldCredit) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const walletRes = await client.query('select * from wallets where user_id = $1', [txn.user_id]);
      const wallet = walletRes.rows[0];
      const newBal = Number(wallet?.balance ?? 0) + Number(txn.amount ?? 0);
      if (txn.type === 'topup') {
        if (wallet) {
          await client.query(
            'update wallets set balance = $1, currency = $2, updated_at = now() where user_id = $3',
            [newBal, wallet?.currency ?? 'KES', txn.user_id]
          );
        } else {
          await client.query(
            'insert into wallets (user_id, balance, currency) values ($1, $2, $3)',
            [txn.user_id, newBal, 'KES']
          );
        }
        console.log('[WEBHOOK] Wallet updated:', txn.user_id, newBal);
      }
      if (txn.type === 'subscription' && txn.meta?.subscription_id) {
        await client.query(
          'update subscriptions set active = true, starts_at = now() where id = $1',
          [txn.meta.subscription_id]
        );
        console.log('[WEBHOOK] Subscription activated:', txn.meta.subscription_id);
      }
      await client.query('COMMIT');
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      console.error('[WEBHOOK] Wallet/subscription update error:', err);
    } finally {
      client.release();
    }
  }
  return NextResponse.json({ ok: true });
}
