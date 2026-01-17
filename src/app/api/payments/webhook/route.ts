import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
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
  const status = data?.status ?? (event?.includes('success') ? 'success' : 'pending');
  const transactionId = data?.transactionId ?? data?.transaction_id;

  if (!transactionId) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data: txn } = await supabase.from('transactions').select('*').eq('reference', transactionId).single();
  if (!txn) return NextResponse.json({ ok: true });

  await supabase.from('transactions').update({ status }).eq('id', txn.id);
  if (status === 'success') {
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', txn.user_id).single();
    const newBal = Number(w?.balance ?? 0) + Number(txn.amount ?? 0);
    if (txn.type === 'topup') {
      await supabase.from('wallets').upsert({ user_id: txn.user_id, balance: newBal, currency: w?.currency ?? 'KES' });
    }
    if (txn.type === 'subscription' && txn.meta?.subscription_id) {
      await supabase
        .from('subscriptions')
        .update({ active: true, starts_at: new Date().toISOString() })
        .eq('id', txn.meta.subscription_id);
    }
  }
  return NextResponse.json({ ok: true });
}
