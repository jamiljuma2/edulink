import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { assignmentId } = await req.json();
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

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('writer_id', user.id)
    .eq('active', true)
    .single();
  if (!sub) return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });

  const tasksPerDay = Number(sub.tasks_per_day ?? 0);
  const unlimited = tasksPerDay === 0;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('writer_id', user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  const tasksToday = todayTasks?.length ?? 0;
  if (!unlimited && tasksToday >= tasksPerDay) {
    return NextResponse.json({ error: 'Daily task limit reached' }, { status: 429 });
  }

  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .update({ writer_id: user.id, status: 'in_progress' })
    .eq('id', assignmentId)
    .eq('status', 'open')
    .is('writer_id', null)
    .select('*')
    .single();

  if (aErr || !assignment) return NextResponse.json({ error: aErr?.message ?? 'Assignment not available' }, { status: 400 });

  const { error: tErr } = await supabase
    .from('tasks')
    .insert({ assignment_id: assignment.id, writer_id: user.id, status: 'accepted' });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, assignment });
}
