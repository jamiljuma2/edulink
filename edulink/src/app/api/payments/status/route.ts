import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getClient, query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

type TransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  created_at: string;
  meta: { walletCredited?: boolean } | null;
};

function normalizePaymentStatus(raw: unknown): 'success' | 'failed' | 'pending' {
  const value = String(raw ?? '').toLowerCase();
  if (!value) return 'pending';
  if (value.includes('success') || value.includes('complete') || value.includes('paid')) return 'success';
  if (value.includes('fail') || value.includes('cancel') || value.includes('declin') || value.includes('revers')) return 'failed';
  return 'pending';
}

function normalizeLipanaPayloadStatus(payload: any): 'success' | 'failed' | 'pending' {
  const candidateStatus =
    payload?.data?.status ??
    payload?.status ??
    payload?.event ??
    payload?.data?.event ??
    payload?.data?.transactionStatus ??
    payload?.data?.paymentStatus ??
    payload?.data?.state ??
    payload?.state;
  let status = normalizePaymentStatus(candidateStatus);
  if (status !== 'success') {
    const eventStatus = String(payload?.event ?? '').toLowerCase();
    const resultCode = String(
      payload?.data?.resultCode ??
      payload?.data?.result_code ??
      payload?.resultCode ??
      payload?.result_code ??
      ''
    ).toLowerCase();
    const successByEvent = eventStatus.includes('success') || eventStatus.includes('completed') || eventStatus.includes('paid');
    const successByCode = resultCode === '0' || resultCode === 'success' || resultCode === 'completed';
    const failedByCode = resultCode === '1' || resultCode === 'failed' || resultCode === 'cancelled' || resultCode === 'canceled';
    if (successByEvent || successByCode) return 'success';
    if (failedByCode) return 'failed';
  }
  return status;
}

async function fetchLipanaStatus(reference: string): Promise<'success' | 'failed' | 'pending' | null> {
  const lipanaKey = process.env.LIPANA_SECRET_KEY;
  if (!lipanaKey) return null;

  const endpoints = [
    `https://api.lipana.dev/v1/transactions/${encodeURIComponent(reference)}`,
    `https://api.lipana.dev/v1/transactions/status?transactionId=${encodeURIComponent(reference)}`,
    `https://api.lipana.dev/v1/transactions/status?reference=${encodeURIComponent(reference)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': lipanaKey,
        },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const payload = await res.json().catch(() => ({}));
      return normalizeLipanaPayloadStatus(payload);
    } catch {
      // Try next endpoint variant.
    }
  }

  return null;
}

async function reconcileWalletTopup(txn: TransactionRow) {
  if (String(txn.status).toLowerCase() !== 'success' || txn.type !== 'topup') return;
  if (txn.meta?.walletCredited === true) return;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<TransactionRow>(
      'select id, user_id, type, amount, currency, status, reference, created_at, meta from transactions where id = $1 for update',
      [txn.id]
    );
    const locked = rows[0];
    if (!locked) {
      await client.query('ROLLBACK');
      return;
    }
    if (locked.meta?.walletCredited === true || String(locked.status).toLowerCase() !== 'success' || locked.type !== 'topup') {
      await client.query('COMMIT');
      return;
    }

    const walletRes = await client.query('select * from wallets where user_id = $1', [locked.user_id]);
    const wallet = walletRes.rows[0];
    const newBal = Number(wallet?.balance ?? 0) + Number(locked.amount ?? 0);

    if (wallet) {
      await client.query(
        'update wallets set balance = $1, currency = $2, updated_at = now() where user_id = $3',
        [newBal, wallet?.currency ?? locked.currency ?? 'KES', locked.user_id]
      );
    } else {
      await client.query(
        'insert into wallets (user_id, balance, currency) values ($1, $2, $3)',
        [locked.user_id, newBal, locked.currency ?? 'KES']
      );
    }

    await client.query(
      `update transactions
       set meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{walletCredited}', 'true'::jsonb, true)
       where id = $1`,
      [locked.id]
    );

    await client.query('COMMIT');
  } catch {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

export async function GET(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  const url = new URL(req.url);
  const reference = url.searchParams.get('reference');
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400, headers: noStoreHeaders });

  const { rows } = await query<TransactionRow>(
    'select id, status, reference, type, amount, currency, created_at, user_id, meta from transactions where reference = $1 and user_id = $2',
    [reference, user.id]
  );
  const txn = rows[0];

  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404, headers: noStoreHeaders });

  if (txn.reference) {
    const providerStatus = await fetchLipanaStatus(txn.reference);
    if (providerStatus && providerStatus !== normalizePaymentStatus(txn.status)) {
      await query('update transactions set status = $1 where id = $2', [providerStatus, txn.id]);
      txn.status = providerStatus;
    }
  }

  await reconcileWalletTopup(txn);

  const { rows: refreshedRows } = await query<TransactionRow>(
    'select id, status, reference, type, amount, currency, created_at, user_id, meta from transactions where id = $1',
    [txn.id]
  );
  const refreshed = refreshedRows[0] ?? txn;

  return NextResponse.json({ transaction: refreshed }, { headers: noStoreHeaders });
}
