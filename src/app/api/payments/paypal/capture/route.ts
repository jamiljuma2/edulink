import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getClient, query } from '@/lib/db';

export async function POST(req: Request) {
  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const user = await getServerFirebaseUser();
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
    await query(
      'update transactions set status = $1, meta = $2 where reference = $3',
      ['failed', { provider: 'paypal', capture: captureJson }, orderId]
    );
    return NextResponse.json({ error: captureJson?.message ?? 'PayPal capture failed' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const txnRes = await client.query(
      'select * from transactions where reference = $1 and user_id = $2',
      [orderId, user.id]
    );
    const txn = txnRes.rows[0];
    if (!txn) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    await client.query(
      'update transactions set status = $1, meta = $2 where id = $3',
      ['success', { provider: 'paypal', capture: captureJson }, txn.id]
    );
    const walletRes = await client.query(
      'select * from wallets where user_id = $1',
      [txn.user_id]
    );
    const wallet = walletRes.rows[0];
    const newBal = Number(wallet?.balance ?? 0) + Number(txn.amount ?? 0);
    if (wallet) {
      await client.query(
        'update wallets set balance = $1, currency = $2, updated_at = now() where user_id = $3',
        [newBal, wallet?.currency ?? txn.currency ?? 'USD', txn.user_id]
      );
    } else {
      await client.query(
        'insert into wallets (user_id, balance, currency) values ($1, $2, $3)',
        [txn.user_id, newBal, txn.currency ?? 'USD']
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Capture failed';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
