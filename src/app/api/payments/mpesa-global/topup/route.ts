import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { amount } = await req.json();
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

  const { data: txn, error: tErr } = await supabase.from('transactions').insert({ user_id: user.id, type: 'topup', amount, currency: 'USD', status: 'pending' }).select('*').single();
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  // Placeholder for M-Pesa Global card checkout URL generation
  const checkoutUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/payments/success?ref=${txn.id}`;
  return NextResponse.json({ checkoutUrl });
}
