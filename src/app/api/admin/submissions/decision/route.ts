import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { submissionId, decision, notes } = await req.json();
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

  const admin = createSupabaseAdmin();
  const { data: submission, error } = await admin
    .from('task_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();
  if (error || !submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  const { data: task } = await admin
    .from('tasks')
    .select('id, assignment_id')
    .eq('id', submission.task_id)
    .single();

  const status = decision === 'approve' ? 'approved' : 'rejected';
  await admin.from('task_submissions').update({ status, notes }).eq('id', submissionId);

  if (status === 'approved') {
    await admin.from('tasks').update({ status: 'approved' }).eq('id', submission.task_id);
    if (task?.assignment_id) {
      await admin.from('assignments').update({ status: 'completed' }).eq('id', task.assignment_id);
    }
  } else {
    await admin.from('tasks').update({ status: 'rejected' }).eq('id', submission.task_id);
    if (task?.assignment_id) {
      await admin.from('assignments').update({ status: 'in_progress' }).eq('id', task.assignment_id);
    }
  }

  return NextResponse.json({ ok: true });
}
