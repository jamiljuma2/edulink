
import AdminDashboardClient from '@/components/dashboards/AdminDashboardClient';
import { requireRole } from '@/lib/auth';
import { createSupabaseServer } from '@/lib/supabaseServer';

export default async function AdminDashboard({ searchParams }: { searchParams?: any }) {
  await requireRole('admin');
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Await searchParams if it's a Promise, then use .get for URLSearchParams, else fallback to object
  let params = searchParams;
  if (params && typeof params.then === 'function') {
    params = await params;
  }
  function getPageParam(param: string) {
    if (params && typeof params.get === 'function') {
      // URLSearchParams API
      return Number(params.get(param) ?? 1);
    } else if (params && typeof params === 'object') {
      // Fallback for Record<string, any>
      return Number(params[param] ?? 1);
    }
    return 1;
  }
  const subPage = getPageParam('subPage');
  const payPage = getPageParam('payPage');
  const withPage = getPageParam('withPage');
  const pageSize = 10;
  const subFrom = (subPage - 1) * pageSize;
  const subTo = subFrom + pageSize - 1;
  const payFrom = (payPage - 1) * pageSize;
  const payTo = payFrom + pageSize - 1;
  const withFrom = (withPage - 1) * pageSize;
  const withTo = withFrom + pageSize - 1;

  // Fetch all dashboard data in parallel
  const [pendingRes, submissionsRes, paymentsRes, withdrawalsRes] = await Promise.all([
    supabase.from('profiles').select('id, email, display_name, role, approval_status, created_at', { count: 'exact' }).eq('approval_status', 'pending').order('created_at', { ascending: true }).range(0, 9),
    supabase.from('task_submissions').select('id, status, notes, created_at, storage_path, task_id, writer_id, tasks:task_id (id, status, assignments:assignment_id (id, title, student_id, writer_id))', { count: 'exact' }).order('created_at', { ascending: false }).range(subFrom, subTo),
    supabase.from('transactions').select('id, user_id, type, amount, currency, status, reference, meta, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(payFrom, payTo),
    supabase.from('transactions').select('id, user_id, type, amount, currency, status, reference, meta, created_at', { count: 'exact' }).eq('type', 'payout').order('created_at', { ascending: false }).range(withFrom, withTo),
  ]);

  const pending = pendingRes.data ?? [];
  const totalPending = pendingRes.count ?? pending.length;
  const submissions = submissionsRes.data ?? [];
  const totalSubmissions = submissionsRes.count ?? submissions.length;
  const payments = paymentsRes.data ?? [];
  const totalPayments = paymentsRes.count ?? payments.length;
  const withdrawals = withdrawalsRes.data ?? [];
  const totalWithdrawals = withdrawalsRes.count ?? withdrawals.length;

  return <AdminDashboardClient
    pending={pending}
    totalPending={totalPending}
    submissions={submissions}
    totalSubmissions={totalSubmissions}
    payments={payments}
    totalPayments={totalPayments}
    withdrawals={withdrawals}
    totalWithdrawals={totalWithdrawals}
    subPage={subPage}
    payPage={payPage}
    withPage={withPage}
    pageSize={pageSize}
  />;
}
