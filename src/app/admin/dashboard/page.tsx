import AdminDashboardClient from '@/components/dashboards/AdminDashboardClient';
import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  approval_status: string;
  created_at: string;
  last_seen_at: string | null;
  is_online: boolean;
};

type SubmissionRow = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  storage_path: string;
  task_id: string;
  writer_id: string;
  tasks: {
    id: string;
    status: string;
    assignments: {
      id: string;
      title: string;
      student_id: string;
      writer_id: string | null;
    } | null;
  } | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  reference: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default async function AdminDashboard({ searchParams }: { searchParams?: any }) {
  await requireRole('admin');

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
  const userPage = getPageParam('userPage');
  const pageSize = 10;
  const subFrom = (subPage - 1) * pageSize;
  const payFrom = (payPage - 1) * pageSize;
  const withFrom = (withPage - 1) * pageSize;
  const userFrom = (userPage - 1) * pageSize;

  // Fetch all dashboard data in parallel
  const [usersRes, usersCountRes, usersOnlineCountRes, submissionsRes, submissionsCountRes, paymentsRes, paymentsCountRes, withdrawalsRes, withdrawalsCountRes] = await Promise.all([
    query<ProfileRow>(
      `select id, email, display_name, role, approval_status, created_at, last_seen_at,
              case when last_seen_at is not null and last_seen_at >= now() - interval '5 minutes' then true else false end as is_online
       from profiles
       order by created_at desc
       limit $1 offset $2`,
      [pageSize, userFrom]
    ),
    query<{ count: string }>('select count(*) from profiles', []),
    query<{ count: string }>(
      `select count(*)
       from profiles
       where last_seen_at is not null and last_seen_at >= now() - interval '5 minutes'`,
      []
    ),
    query<SubmissionRow>(
      `select ts.id, ts.status, ts.notes, ts.created_at, ts.storage_path, ts.task_id, ts.writer_id,
              jsonb_build_object(
                'id', t.id,
                'status', t.status,
                'assignments', jsonb_build_object(
                  'id', a.id,
                  'title', a.title,
                  'student_id', a.student_id,
                  'writer_id', a.writer_id
                )
              ) as tasks
       from task_submissions ts
       left join tasks t on t.id = ts.task_id
       left join assignments a on a.id = t.assignment_id
       order by ts.created_at desc
       limit $1 offset $2`,
      [pageSize, subFrom]
    ),
    query<{ count: string }>('select count(*) from task_submissions', []),
    query<PaymentRow>(
      `select id, user_id, type, amount, currency, status, reference, meta, created_at
       from transactions
       order by created_at desc
       limit $1 offset $2`,
      [pageSize, payFrom]
    ),
    query<{ count: string }>('select count(*) from transactions', []),
    query<PaymentRow>(
      `select id, user_id, type, amount, currency, status, reference, meta, created_at
       from transactions
       where type = 'payout'
       order by created_at desc
       limit $1 offset $2`,
      [pageSize, withFrom]
    ),
    query<{ count: string }>("select count(*) from transactions where type = 'payout'", []),
  ]);
  const users = usersRes.rows ?? [];
  const totalUsers = Number(usersCountRes.rows[0]?.count ?? users.length);
  const onlineUsers = Number(usersOnlineCountRes.rows[0]?.count ?? 0);
  const offlineUsers = Math.max(0, totalUsers - onlineUsers);
  const submissions = submissionsRes.rows ?? [];
  const totalSubmissions = Number(submissionsCountRes.rows[0]?.count ?? submissions.length);
  const payments = paymentsRes.rows ?? [];
  const totalPayments = Number(paymentsCountRes.rows[0]?.count ?? payments.length);
  const withdrawals = withdrawalsRes.rows ?? [];
  const totalWithdrawals = Number(withdrawalsCountRes.rows[0]?.count ?? withdrawals.length);

  return <AdminDashboardClient
    users={users}
    totalUsers={totalUsers}
    onlineUsers={onlineUsers}
    offlineUsers={offlineUsers}
    submissions={submissions}
    totalSubmissions={totalSubmissions}
    payments={payments}
    totalPayments={totalPayments}
    withdrawals={withdrawals}
    totalWithdrawals={totalWithdrawals}
    subPage={subPage}
    payPage={payPage}
    withPage={withPage}
    userPage={userPage}
    pageSize={pageSize}
  />;
}
