import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { SUBSCRIPTION_PLANS } from '@/lib/roles';
import { convertUsdToKes, getUsdToKesRate } from '@/lib/exchangeRates';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { subscriptionId, phone } = await req.json();
  if (!subscriptionId || !phone) {
    return NextResponse.json({ error: 'subscriptionId and phone required' }, { status: 400 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  const { data: sub, error: sErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('writer_id', user.id)
    .single();
  if (sErr || !sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

  const conf = SUBSCRIPTION_PLANS[sub.plan as keyof typeof SUBSCRIPTION_PLANS];
  if (!conf) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  const rate = await getUsdToKesRate();
  const amount = convertUsdToKes(conf.price, rate);
  if (amount < 10) return NextResponse.json({ error: 'Minimum amount is KES 10' }, { status: 400 });

  const lipanaKey = process.env.LIPANA_SECRET_KEY;
  if (!lipanaKey) return NextResponse.json({ error: 'Lipana secret key missing' }, { status: 500 });

  const { data: txn, error: tErr } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'subscription',
      amount,
      currency: 'KES',
      status: 'pending',
      meta: { subscription_id: subscriptionId, fx: { usd_to_kes: rate, usd_amount: conf.price } },
    })
    .select('*')
    .single();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

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
  await supabase.from('transactions').update({ reference: transactionId, meta: { subscription_id: subscriptionId, lipana: payload } }).eq('id', txn.id);

  return NextResponse.json({ ok: true, lipana: payload });
}
