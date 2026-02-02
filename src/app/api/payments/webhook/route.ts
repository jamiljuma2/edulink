import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const admin = createSupabaseAdmin();
  const raw = await req.text();
  const signature = req.headers.get('x-lipana-signature');
  const webhookSecret = process.env.LIPANA_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    const expected = createHmac('sha256', webhookSecret).update(raw).digest('hex');
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
  const status = isSuccess ? 'completed' : rawStatus || 'pending';
  const transactionId = data?.transactionId ?? data?.transaction_id;

  if (!transactionId) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data: txn } = await admin.from('transactions').select('*').eq('reference', transactionId).single();
  if (!txn) return NextResponse.json({ ok: true });

  const wasCompleted = String(txn.status ?? '').toLowerCase() === 'completed';
  const shouldCredit = status === 'completed' && !wasCompleted;

  if (!wasCompleted || status !== txn.status) {
    await admin.from('transactions').update({ status }).eq('id', txn.id);
  }

  if (shouldCredit) {
    const { data: w } = await admin.from('wallets').select('*').eq('user_id', txn.user_id).single();
    const newBal = Number(w?.balance ?? 0) + Number(txn.amount ?? 0);
    if (txn.type === 'topup') {
      await admin.from('wallets').upsert({ user_id: txn.user_id, balance: newBal, currency: w?.currency ?? 'KES' });
    }
    if (txn.type === 'subscription' && txn.meta?.subscription_id) {
      await admin
        .from('subscriptions')
        .update({ active: true, starts_at: new Date().toISOString() })
        .eq('id', txn.meta.subscription_id);
    }
  }
  return NextResponse.json({ ok: true });
}
