
import WriterDashboardClient from '@/components/dashboards/WriterDashboardClient';
import { requireRole } from '@/lib/auth';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export default async function WriterDashboard({ searchParams }: { searchParams?: any }) {
  await requireRole('writer');
  const user = await getServerFirebaseUser();
  if (!user) return null;

  // Await searchParams if it's a Promise, then use .get('page') for URLSearchParams, else fallback to object
  let params = searchParams;
  if (params && typeof params.then === 'function') {
    params = await params;
  }
  let page = 1;
  if (params && typeof params.get === 'function') {
    page = Number(params.get('page') ?? 1);
  } else if (params && typeof params === 'object') {
    page = Number(params.page ?? 1);
  }
  const pageSize = 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Fetch all dashboard data in parallel
  const [summaryRes, openAssignmentsRes, openCountRes, myTasksRes, submissionsRes, earningsRes] = await Promise.all([
    query('select * from subscriptions where writer_id = $1 and active = true limit 1', [user.id]),
    query(
      "select * from assignments where status = 'open' order by created_at desc limit $1 offset $2",
      [pageSize, from]
    ),
    query<{ count: string }>("select count(*) from assignments where status = 'open'", []),
    query(
      `select t.*, jsonb_build_object(
          'id', a.id,
          'title', a.title,
          'description', a.description,
          'due_date', a.due_date
        ) as assignments
       from tasks t
       left join assignments a on a.id = t.assignment_id
       where t.writer_id = $1
       order by t.created_at desc`,
      [user.id]
    ),
    query(
      'select id, task_id, status, notes, created_at from task_submissions where writer_id = $1 order by created_at desc',
      [user.id]
    ),
    query(
      `select t.id, t.created_at, jsonb_build_object('title', a.title) as assignments
       from tasks t
       left join assignments a on a.id = t.assignment_id
       where t.writer_id = $1 and t.status = 'approved'
       order by t.created_at desc`,
      [user.id]
    ),
  ]);

  // Summary
  const summaryRow = summaryRes.rows[0];
  const hasSubscription = !!summaryRow;
  const plan = summaryRow?.plan ?? null;
  const tasksPerDay = summaryRow?.tasks_per_day ?? 0;
  // Open assignments
  const openAssignments = openAssignmentsRes.rows ?? [];
  const totalOpenAssignments = Number(openCountRes.rows[0]?.count ?? openAssignments.length);
  // My tasks
  const myTasks = myTasksRes.rows ?? [];
  // Submissions
  const submissions = submissionsRes.rows ?? [];
  // Earnings
  const earningTasks = earningsRes.rows ?? [];
  const approvedTasks = earningTasks.length;
  const taskRate = Number(process.env.WRITER_TASK_EARNINGS_KES ?? process.env.NEXT_PUBLIC_WRITER_TASK_EARNINGS_KES ?? 0);
  const availableEarnings = approvedTasks * taskRate;

  return <WriterDashboardClient
    hasSubscription={hasSubscription}
    plan={plan}
    tasksPerDay={tasksPerDay}
    openAssignments={openAssignments}
    totalOpenAssignments={totalOpenAssignments}
    page={page}
    pageSize={pageSize}
    myTasks={myTasks}
    submissions={submissions}
    earningTasks={earningTasks}
    approvedTasks={approvedTasks}
    taskRate={taskRate}
    availableEarnings={availableEarnings}
  />;
}
