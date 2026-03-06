import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getClient, query } from '@/lib/db';

export async function POST(req: Request) {
  const { taskId, storagePath, notes } = await req.json();
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  const { rows: taskRows } = await query(
    'select * from tasks where id = $1 and writer_id = $2',
    [taskId, user.id]
  );
  const task = taskRows[0];
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  if (!['accepted', 'working', 'rejected'].includes(String(task.status))) {
    return NextResponse.json({ error: 'Task is not eligible for submission' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'insert into task_submissions (task_id, writer_id, storage_path, notes, status) values ($1, $2, $3, $4, $5)',
      [taskId, user.id, storagePath, notes ?? null, 'pending']
    );
    await client.query('update tasks set status = $1 where id = $2', ['submitted', taskId]);
    await client.query('update assignments set status = $1 where id = $2', ['submitted', task.assignment_id]);
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Submission failed';
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
