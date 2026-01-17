import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { amount, phone } = await req.json();
  if (!amount || !phone) return NextResponse.json({ error: 'amount and phone required' }, { status: 400 });

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

  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
  const balance = Number(wallet?.balance ?? 0);
  if (Number(amount) > balance) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

  // Record pending payout transaction (actual payout integration can be added later)
  const { error: tErr } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'payout',
    amount: Number(amount),
    currency: wallet?.currency ?? 'KES',
    status: 'pending',
    meta: { phone },
  });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, message: 'Withdrawal request submitted.' });
}
