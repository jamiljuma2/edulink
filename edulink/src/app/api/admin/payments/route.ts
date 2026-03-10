import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

async function reconcilePendingIncomingPayments(limit = 25): Promise<void> {
  const { rows } = await query<{ id: string; reference: string; status: string }>(
    `select id, reference, status
     from transactions
     where type in ('topup', 'payment', 'subscription')
       and status = 'pending'
       and reference is not null
     order by created_at desc
     limit $1`,
    [limit]
  );

  await Promise.all(
    rows.map(async (txn) => {
      const providerStatus = await fetchLipanaStatus(txn.reference);
      if (!providerStatus || providerStatus === normalizePaymentStatus(txn.status)) return;
      await query('update transactions set status = $1 where id = $2', [providerStatus, txn.id]);
    })
  );
}

export async function GET(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const url = new URL(req.url);
  const includePayoutsParam = url.searchParams.get('includePayouts');
  const includePayouts = includePayoutsParam === null ? true : includePayoutsParam === 'true';
  const limitParam = Number(url.searchParams.get('limit') ?? '50');
  const offsetParam = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

  await reconcilePendingIncomingPayments(Math.min(Math.max(limit, 10), 50));

  const { rows } = await query(
    `select id, user_id, type, amount, currency, status, reference, meta, created_at
     from transactions
     where ($3::boolean = true or type in ('topup', 'payment', 'subscription'))
     order by created_at desc
     limit $1 offset $2`,
    [limit, offset, includePayouts]
  );

  return NextResponse.json(
    { payments: rows ?? [] },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}
