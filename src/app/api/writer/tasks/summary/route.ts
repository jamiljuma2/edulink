import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

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

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('writer_id', user.id)
    .eq('active', true)
    .single();

  if (!sub) return NextResponse.json({ hasSubscription: false });

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('writer_id', user.id)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());

  const tasksToday = tasks?.length ?? 0;
  const tasksPerDay = Number(sub.tasks_per_day ?? 0);
  const unlimited = tasksPerDay === 0;
  const remaining = unlimited ? null : Math.max(tasksPerDay - tasksToday, 0);

  return NextResponse.json({
    hasSubscription: true,
    plan: sub.plan,
    tasksPerDay,
    tasksToday,
    remaining,
  });
}
