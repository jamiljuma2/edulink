import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
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

  if (!sub) return NextResponse.json({ hasSubscription: false });

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { rows: taskRows } = await query<{ count: string }>(
    'select count(*) from tasks where writer_id = $1 and created_at >= $2 and created_at < $3',
    [user.id, start.toISOString(), end.toISOString()]
  );
  const tasksToday = Number(taskRows[0]?.count ?? 0);
  const tasksPerDay = Number(sub.tasks_per_day ?? 0);
  const unlimited = tasksPerDay === 0;
  const remaining = unlimited ? null : Math.max(tasksPerDay - tasksToday, 0);

  return NextResponse.json(
    { hasSubscription: true, plan: sub.plan, tasksPerDay, tasksToday, remaining },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
