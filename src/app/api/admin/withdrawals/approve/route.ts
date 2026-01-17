import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const { transactionId } = await req.json();
  if (!transactionId) return NextResponse.json({ error: 'transactionId required' }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: txn, error } = await admin
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('type', 'payout')
    .single();
  if (error || !txn) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });

  // Mark approved (actual payout integration can be added later)
  const { error: uErr } = await admin.from('transactions').update({ status: 'success' }).eq('id', transactionId);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
