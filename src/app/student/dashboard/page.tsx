
import StudentDashboardClient from '@/components/dashboards/StudentDashboardClient';
import { requireRole } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabaseServer';

export default async function StudentDashboard({ searchParams }: { searchParams?: any }) {
  await requireRole('student');
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

  // Fetch wallet and assignments in parallel
  const [{ data: walletData }, { data: assignmentsData, count }] = await Promise.all([
    supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
    supabase.from('assignments').select('*', { count: 'exact' }).eq('student_id', user.id).order('created_at', { ascending: false }).range(from, to),
  ]);

  const wallet = Number(walletData?.balance ?? 0);
  const assignments = assignmentsData ?? [];
  const totalAssignments = count ?? assignments.length;

  return <StudentDashboardClient wallet={wallet} assignments={assignments} totalAssignments={totalAssignments} page={page} pageSize={pageSize} />;
}
