import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getClient, query } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const { taskId, storagePath, notes } = await req.json();
  if (typeof taskId !== 'string' || !UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
  }
  if (typeof storagePath !== 'string' || storagePath.length < 3) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
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
    console.error('Task submit error:', err);
    return NextResponse.json({ error: 'Submission failed' }, { status: 400 });
  } finally {
    client.release();
  }
}
