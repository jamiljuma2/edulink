import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getClient, query } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const { submissionId, decision, notes } = await req.json();
  if (typeof submissionId !== 'string' || !UUID_RE.test(submissionId)) {
    return NextResponse.json({ error: 'Invalid submission id' }, { status: 400 });
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }
  // Require a note for rejection
  if (decision === 'reject' && (!notes || typeof notes !== 'string' || notes.trim().length === 0)) {
    return NextResponse.json({ error: 'A note is required for rejection.' }, { status: 400 });
  }
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const submissionRes = await client.query('select * from task_submissions where id = $1', [submissionId]);
    const submission = submissionRes.rows[0];
    if (!submission) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }
    const taskRes = await client.query('select id, assignment_id from tasks where id = $1', [submission.task_id]);
    const task = taskRes.rows[0];
    const status = decision === 'approve' ? 'approved' : 'rejected';
    await client.query('update task_submissions set status = $1, notes = $2 where id = $3', [status, notes ?? null, submissionId]);
    if (status === 'approved') {
      const taskUpdateRes = await client.query('update tasks set status = $1 where id = $2', ['approved', submission.task_id]);
      console.log('Task status updated to approved:', submission.task_id, 'Result:', taskUpdateRes.rowCount);
      if (task?.assignment_id) {
        const assignmentUpdateRes = await client.query('update assignments set status = $1 where id = $2', ['completed', task.assignment_id]);
        console.log('Assignment status updated to completed:', task.assignment_id, 'Result:', assignmentUpdateRes.rowCount);
      }
    } else {
      const taskUpdateRes = await client.query('update tasks set status = $1 where id = $2', ['rejected', submission.task_id]);
      console.log('Task status updated to rejected:', submission.task_id, 'Result:', taskUpdateRes.rowCount);
      if (task?.assignment_id) {
        const assignmentUpdateRes = await client.query('update assignments set status = $1 where id = $2', ['in_progress', task.assignment_id]);
        console.log('Assignment status updated to in_progress:', task.assignment_id, 'Result:', assignmentUpdateRes.rowCount);
      }
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Submission decision error:', err);
    return NextResponse.json({ error: 'Decision failed' }, { status: 400 });
  } finally {
    client.release();
  }
}
