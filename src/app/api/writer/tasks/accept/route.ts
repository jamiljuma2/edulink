import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { getClient, query } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const { assignmentId } = await req.json();
  if (typeof assignmentId !== 'string' || !UUID_RE.test(assignmentId)) {
    return NextResponse.json({ error: 'Invalid assignment id' }, { status: 400 });
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

  const { rows: subRows } = await query(
    'select * from subscriptions where writer_id = $1 and active = true limit 1',
    [user.id]
  );
  const sub = subRows[0];
  if (!sub) return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });

  const tasksPerDay = Number(sub.tasks_per_day ?? 0);
  const unlimited = tasksPerDay === 0;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { rows: taskCountRows } = await query<{ count: string }>(
    'select count(*) from tasks where writer_id = $1 and created_at >= $2 and created_at < $3',
    [user.id, start.toISOString(), end.toISOString()]
  );
  const tasksToday = Number(taskCountRows[0]?.count ?? 0);
  if (!unlimited && tasksToday >= tasksPerDay) {
    return NextResponse.json({ error: 'Daily task limit reached' }, { status: 429 });
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const assignmentRes = await client.query(
      `update assignments
       set writer_id = $1, status = 'in_progress'
       where id = $2 and status = 'open' and writer_id is null
       returning *`,
      [user.id, assignmentId]
    );
    const assignment = assignmentRes.rows[0];
    if (!assignment) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Assignment not available' }, { status: 400 });
    }
    await client.query(
      'insert into tasks (assignment_id, writer_id, status) values ($1, $2, $3)',
      [assignment.id, user.id, 'accepted']
    );
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, assignment });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('Accept assignment error:', err);
    return NextResponse.json({ error: 'Failed to accept assignment' }, { status: 400 });
  } finally {
    client.release();
  }
}
