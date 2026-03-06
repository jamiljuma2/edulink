import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  const { amount } = await req.json();
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'student') return NextResponse.json({ error: 'Student role required' }, { status: 403 });
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });

  const paypalClientId = process.env.PAYPAL_CLIENT_ID;
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const paypalEnv = process.env.PAYPAL_ENV ?? 'sandbox';
  if (!paypalClientId || !paypalClientSecret) {
    return NextResponse.json({ error: 'PayPal credentials missing' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
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
    console.error('PayPal token error', tokenJson);
    return NextResponse.json({
      error: tokenJson?.error_description ?? 'PayPal token error',
      details: tokenJson,
    }, { status: 400 });
  }

  const { rows: txnRows } = await query(
    `insert into transactions (user_id, type, amount, currency, status, meta)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [user.id, 'topup', amount, 'USD', 'pending', { provider: 'paypal' }]
  );
  const txn = txnRows[0];
  if (!txn) return NextResponse.json({ error: 'Failed to create transaction' }, { status: 400 });

  const orderRes = await fetch(`${paypalBase}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: Number(amount).toFixed(2) },
          custom_id: txn.id,
        },
      ],
      application_context: {
        return_url: `${baseUrl}/payments/paypal/return`,
        cancel_url: `${baseUrl}/payments/paypal/cancel`,
      },
    }),
  });

  const orderJson = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok) {
    console.error('PayPal order error', orderJson);
    return NextResponse.json({
      error: orderJson?.message ?? 'PayPal order error',
      details: orderJson,
    }, { status: 400 });
  }

  const approvalUrl = Array.isArray(orderJson?.links)
    ? orderJson.links.find((l: { rel: string }) => l.rel === 'approve')?.href
    : null;

  await query(
    'update transactions set reference = $1, meta = $2 where id = $3',
    [orderJson.id, { provider: 'paypal', order: orderJson }, txn.id]
  );

  if (!approvalUrl) return NextResponse.json({ error: 'PayPal approval link missing' }, { status: 400 });
  return NextResponse.json({ checkoutUrl: approvalUrl });
}
