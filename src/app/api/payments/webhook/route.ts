import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {

  const admin = createSupabaseAdmin();
  const raw = await req.text();
  // Log all headers for debugging
  const headersObj = {};
  req.headers.forEach((value, key) => { headersObj[key] = value; });
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
  const status = isSuccess ? 'completed' : rawStatus || 'pending';
  const transactionId = data?.transactionId ?? data?.transaction_id;

  // LOG: Decoded payload and transactionId
  console.log('[WEBHOOK] Decoded payload:', payload);
  console.log('[WEBHOOK] TransactionId:', transactionId);

  if (!transactionId) {
    console.error('[WEBHOOK] Invalid payload: missing transactionId');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: txn, error: txnErr } = await admin.from('transactions').select('*').eq('reference', transactionId).single();
  if (txnErr) console.error('[WEBHOOK] Transaction lookup error:', txnErr);
  if (!txn) {
    console.warn('[WEBHOOK] No transaction found for reference:', transactionId);
    return NextResponse.json({ ok: true });
  }

  const wasCompleted = String(txn.status ?? '').toLowerCase() === 'completed';
  const shouldCredit = status === 'completed' && !wasCompleted;

  if (!wasCompleted || status !== txn.status) {
    const { error: updateErr } = await admin.from('transactions').update({ status }).eq('id', txn.id);
    if (updateErr) console.error('[WEBHOOK] Transaction status update error:', updateErr);
    else console.log('[WEBHOOK] Transaction status updated:', txn.id, status);
  }

  if (shouldCredit) {
    const { data: w, error: wErr } = await admin.from('wallets').select('*').eq('user_id', txn.user_id).single();
    if (wErr) console.error('[WEBHOOK] Wallet lookup error:', wErr);
    const newBal = Number(w?.balance ?? 0) + Number(txn.amount ?? 0);
    if (txn.type === 'topup') {
      const { error: upsertErr } = await admin.from('wallets').upsert({ user_id: txn.user_id, balance: newBal, currency: w?.currency ?? 'KES' });
      if (upsertErr) console.error('[WEBHOOK] Wallet upsert error:', upsertErr);
      else console.log('[WEBHOOK] Wallet updated:', txn.user_id, newBal);
    }
    if (txn.type === 'subscription' && txn.meta?.subscription_id) {
      const { error: subErr } = await admin
        .from('subscriptions')
        .update({ active: true, starts_at: new Date().toISOString() })
        .eq('id', txn.meta.subscription_id);
      if (subErr) console.error('[WEBHOOK] Subscription update error:', subErr);
      else console.log('[WEBHOOK] Subscription activated:', txn.meta.subscription_id);
    }
  }
  return NextResponse.json({ ok: true });
}
