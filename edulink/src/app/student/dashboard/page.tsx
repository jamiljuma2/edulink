
import StudentDashboardClient from '@/components/dashboards/StudentDashboardClient';
import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function StudentDashboard({ searchParams }: { searchParams?: any }) {
  const { user } = await requireRole('student');

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
  const [{ rows: walletRows }, { rows: assignmentsRows }, { rows: countRows }] = await Promise.all([
    query('select balance from wallets where user_id = $1', [user.id]),
    query(
      'select * from assignments where student_id = $1 order by created_at desc limit $2 offset $3',
      [user.id, pageSize, from]
    ),
    query<{ count: string }>('select count(*) from assignments where student_id = $1', [user.id]),
  ]);

  const wallet = Number(walletRows[0]?.balance ?? 0);
  const assignments = assignmentsRows ?? [];
  const totalAssignments = Number(countRows[0]?.count ?? assignments.length);

  return <StudentDashboardClient wallet={wallet} assignments={assignments} totalAssignments={totalAssignments} page={page} pageSize={pageSize} />;
}
