import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
import { SUBSCRIPTION_PLANS } from '@/lib/roles';
import { convertUsdToKes, getUsdToKesRate } from '@/lib/exchangeRates';

type SubscriptionRow = {
  plan: keyof typeof SUBSCRIPTION_PLANS;
};

export async function POST(req: Request) {
  const { subscriptionId, phone } = await req.json();
  if (!subscriptionId || !phone) {
    return NextResponse.json({ error: 'subscriptionId and phone required' }, { status: 400 });
  }

  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  const { rows: subRows } = await query<SubscriptionRow>(
    'select * from subscriptions where id = $1 and writer_id = $2',
    [subscriptionId, user.id]
  );
  const sub = subRows[0];
  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

  const conf = SUBSCRIPTION_PLANS[sub.plan as keyof typeof SUBSCRIPTION_PLANS];
  if (!conf) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  const rate = await getUsdToKesRate();
  const amount = convertUsdToKes(conf.price, rate);
  if (amount < 10) return NextResponse.json({ error: 'Minimum amount is KES 10' }, { status: 400 });

  const lipanaKey = process.env.LIPANA_SECRET_KEY;
  if (!lipanaKey) return NextResponse.json({ error: 'Lipana secret key missing' }, { status: 500 });

  const { rows: txnRows } = await query(
    `insert into transactions (user_id, type, amount, currency, status, meta)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [user.id, 'subscription', amount, 'KES', 'pending', { subscription_id: subscriptionId, fx: { usd_to_kes: rate, usd_amount: conf.price } }]
  );
  const txn = txnRows[0];
  if (!txn) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 400 });

  const res = await fetch('https://api.lipana.dev/v1/transactions/push-stk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': lipanaKey,
    },
    body: JSON.stringify({ phone, amount }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: payload?.message ?? 'Lipana STK push failed' }, { status: 400 });
  }

  const transactionId = payload?.data?.transactionId ?? payload?.data?.transaction_id;
  await query(
    'update transactions set reference = $1, meta = $2 where id = $3',
    [transactionId, { subscription_id: subscriptionId, lipana: payload }, txn.id]
  );

  return NextResponse.json({ ok: true, lipana: payload });
}
