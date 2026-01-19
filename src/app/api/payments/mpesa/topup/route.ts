import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'edge';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { amount, phone } = await req.json();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'student') return NextResponse.json({ error: 'Student role required' }, { status: 403 });

  const lipanaKey = process.env.LIPANA_SECRET_KEY;
  if (!lipanaKey) {
    return NextResponse.json({ error: 'Lipana secret key missing' }, { status: 500 });
  }
  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }
  if (Number(amount) < 10) {
    return NextResponse.json({ error: 'Minimum amount is KES 10' }, { status: 400 });
  }

  const res = await fetch('https://api.lipana.dev/v1/transactions/push-stk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': lipanaKey,
    },
    body: JSON.stringify({ phone, amount: Number(amount) }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: payload?.message ?? 'Lipana STK push failed' }, { status: 400 });
  }

  const transactionId = payload?.data?.transactionId ?? payload?.data?.transaction_id;
  const { error: tErr } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'topup',
    amount,
    currency: 'KES',
    status: 'pending',
    reference: transactionId,
    meta: payload,
  });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, lipana: payload, reference: transactionId });
}
