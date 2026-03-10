import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_TASK_RATE_KES = Number(
  process.env.WRITER_TASK_EARNINGS_KES ??
  process.env.NEXT_PUBLIC_WRITER_TASK_EARNINGS_KES ??
  0
);

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

  const { rows: tasks } = await query(
    `select t.id, t.created_at, jsonb_build_object('title', a.title) as assignments
     from tasks t
     left join assignments a on a.id = t.assignment_id
     where t.writer_id = $1 and t.status = 'approved'
     order by t.created_at desc`,
    [user.id]
  );

  const approvedTasks = tasks?.length ?? 0;
  const taskRate = Number.isFinite(DEFAULT_TASK_RATE_KES) ? DEFAULT_TASK_RATE_KES : 0;
  const availableEarnings = approvedTasks * taskRate;

  return NextResponse.json(
    { currency: 'KES', taskRate, approvedTasks, availableEarnings, tasks: tasks ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
