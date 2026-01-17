import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { taskId, storagePath, notes } = await req.json();
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

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('writer_id', user.id)
    .single();
  if (tErr || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  const { error: sErr } = await supabase
    .from('task_submissions')
    .insert({ task_id: taskId, writer_id: user.id, storage_path: storagePath, notes, status: 'pending' });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  await supabase.from('tasks').update({ status: 'submitted' }).eq('id', taskId);
  await supabase.from('assignments').update({ status: 'submitted' }).eq('id', task.assignment_id);

  return NextResponse.json({ ok: true });
}
