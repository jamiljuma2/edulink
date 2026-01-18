import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const paypalEnv = process.env.PAYPAL_ENV ?? 'sandbox';
  if (!paypalClientId || !paypalClientSecret) {
    return NextResponse.json({ error: 'PayPal credentials missing' }, { status: 500 });
  }

  const paypalBase = paypalEnv === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  const tokenRes = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) {
    return NextResponse.json({ error: tokenJson?.error_description ?? 'PayPal token error' }, { status: 400 });
  }

  const captureRes = await fetch(`${paypalBase}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  const captureJson = await captureRes.json().catch(() => ({}));
  if (!captureRes.ok) {
    await supabase.from('transactions').update({ status: 'failed', meta: { provider: 'paypal', capture: captureJson } }).eq('reference', orderId);
    return NextResponse.json({ error: captureJson?.message ?? 'PayPal capture failed' }, { status: 400 });
  }

  const { data: txn } = await supabase
    .from('transactions')
    .select('*')
    .eq('reference', orderId)
    .eq('user_id', user.id)
    .single();

  if (!txn) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  await supabase
    .from('transactions')
    .update({ status: 'completed', meta: { provider: 'paypal', capture: captureJson } })
    .eq('id', txn.id);

  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', txn.user_id).single();
  const newBal = Number(wallet?.balance ?? 0) + Number(txn.amount ?? 0);
  await supabase.from('wallets').upsert({
    user_id: txn.user_id,
    balance: newBal,
    currency: wallet?.currency ?? txn.currency ?? 'USD',
  });

  return NextResponse.json({ ok: true });
}
