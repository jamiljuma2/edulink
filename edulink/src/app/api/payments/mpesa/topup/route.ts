import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
import { normalizeKenyanPhone } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function POST(req: Request) {
  const { amount, phone } = await req.json();
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403, headers: noStoreHeaders });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403, headers: noStoreHeaders });
  if (profile.role !== 'student') return NextResponse.json({ error: 'Student role required' }, { status: 403, headers: noStoreHeaders });

  const lipanaKey = process.env.LIPANA_SECRET_KEY;
  if (!lipanaKey) {
    return NextResponse.json({ error: 'Lipana secret key missing' }, { status: 500, headers: noStoreHeaders });
  }
  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400, headers: noStoreHeaders });
  }
  const normalizedPhone = normalizeKenyanPhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: 'Enter a valid Safaricom M-Pesa number (e.g. 07..., 254..., or +254...).' }, { status: 400, headers: noStoreHeaders });
  }
  if (Number(amount) < 10) {
    return NextResponse.json({ error: 'Minimum amount is KES 10' }, { status: 400, headers: noStoreHeaders });
  }

  const res = await fetch('https://api.lipana.dev/v1/transactions/push-stk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': lipanaKey,
    },
    body: JSON.stringify({ phone: normalizedPhone, amount: Number(amount) }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: payload?.message ?? 'Lipana STK push failed' }, { status: 400, headers: noStoreHeaders });
  }

  const transactionId =
    payload?.data?.transactionId ??
    payload?.data?.transaction_id ??
    payload?.data?.reference ??
    payload?.data?.id ??
    payload?.data?.checkoutRequestId ??
    payload?.data?.merchantRequestId ??
    payload?.transactionId ??
    payload?.transaction_id ??
    payload?.reference ??
    payload?.id;
  await query(
    `insert into transactions (user_id, type, amount, currency, status, reference, meta)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [user.id, 'topup', amount, 'KES', 'pending', transactionId, payload]
  );

  return NextResponse.json({ ok: true, lipana: payload, reference: transactionId }, { headers: noStoreHeaders });
}
