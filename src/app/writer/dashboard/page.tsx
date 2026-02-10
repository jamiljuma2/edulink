
import WriterDashboardClient from '@/components/dashboards/WriterDashboardClient';
import { requireRole } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabaseServer';

export default async function WriterDashboard({ searchParams }: { searchParams?: any }) {
  await requireRole('writer');
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
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
  const [summaryRes, openAssignmentsRes, myTasksRes, submissionsRes, earningsRes] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('writer_id', user.id).eq('active', true).maybeSingle(),
    supabase.from('assignments').select('*', { count: 'exact' }).eq('status', 'open').order('created_at', { ascending: false }).range(from, to),
    supabase.from('tasks').select('*, assignments(*)').eq('writer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('task_submissions').select('id, task_id, status, notes, created_at').eq('writer_id', user.id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('id, created_at, assignments:assignment_id (title)').eq('writer_id', user.id).eq('status', 'approved').order('created_at', { ascending: false }),
  ]);

  // Summary
  const hasSubscription = !!summaryRes.data;
  const plan = summaryRes.data?.plan ?? null;
  const tasksPerDay = summaryRes.data?.tasks_per_day ?? 0;
  // Open assignments
  const openAssignments = openAssignmentsRes.data ?? [];
  const totalOpenAssignments = openAssignmentsRes.count ?? openAssignments.length;
  // My tasks
  const myTasks = myTasksRes.data ?? [];
  // Submissions
  const submissions = submissionsRes.data ?? [];
  // Earnings
  const earningTasks = earningsRes.data ?? [];
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
