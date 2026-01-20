import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

const DEFAULT_TASK_RATE_KES = Number(
  process.env.WRITER_TASK_EARNINGS_KES ??
  process.env.NEXT_PUBLIC_WRITER_TASK_EARNINGS_KES ??
  0
);

export async function GET() {
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
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('id, created_at, assignments:assignment_id (title)')
    .eq('writer_id', user.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  const approvedTasks = tasks?.length ?? 0;
  const taskRate = Number.isFinite(DEFAULT_TASK_RATE_KES) ? DEFAULT_TASK_RATE_KES : 0;
  const availableEarnings = approvedTasks * taskRate;

  return NextResponse.json({
    currency: 'KES',
    taskRate,
    approvedTasks,
    availableEarnings,
    tasks: tasks ?? [],
  });
}
