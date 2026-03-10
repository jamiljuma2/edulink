"use client";
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ShieldCheck, Users, FileCheck2, Bell, CircleDot } from 'lucide-react';
import DashboardShell, { NavItem } from '@/components/layouts/DashboardShell';

type UserAccount = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  approval_status: string;
  created_at: string;
  last_seen_at: string | null;
  is_online: boolean;
};

type Submission = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  storage_path: string;
  tasks?: { id: string; status: string; assignments?: { id: string; title: string } | null } | null;
};
type Payment = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  reference: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
};
type Withdrawal = Payment;

type ModalState =
  | { kind: 'none' }
  | { kind: 'submission'; data: Submission }
  | { kind: 'payment'; data: Payment };

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4 text-sm text-[color:var(--muted)]">{children}</div>
      </div>
    </div>
  );
}

type AdminDashboardClientProps = {
  users: UserAccount[];
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  submissions: Submission[];
  totalSubmissions: number;
  payments: Payment[];
  totalPayments: number;
  withdrawals: Withdrawal[];
  totalWithdrawals: number;
  userPage: number;
  subPage: number;
  payPage: number;
  withPage: number;
  pageSize: number;
};

export default function AdminDashboardClient({
  users,
  totalUsers,
  onlineUsers,
  offlineUsers,
  submissions,
  totalSubmissions,
  payments,
  totalPayments,
  withdrawals,
  totalWithdrawals,
  userPage,
  subPage,
  payPage,
  withPage,
  pageSize,
}: AdminDashboardClientProps) {
  const navItems: NavItem[] = [
    { label: 'Approvals', icon: Users },
    { label: 'Submissions', icon: FileCheck2 },
    { label: 'Policies', icon: ShieldCheck },
  ];
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [usersData, setUsersData] = useState<UserAccount[]>(users);
  const [paymentsData, setPaymentsData] = useState<Payment[]>(payments);
  const [isRefreshingPayments, setIsRefreshingPayments] = useState(false);
  const [paymentsRefreshError, setPaymentsRefreshError] = useState<string | null>(null);
  const [presenceCounts, setPresenceCounts] = useState({ onlineUsers, offlineUsers });
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [showSubmissionsPanel, setShowSubmissionsPanel] = useState(false);
  const [showPaymentsPanel, setShowPaymentsPanel] = useState(true);
  const [showWithdrawalsPanel, setShowWithdrawalsPanel] = useState(false);

  async function updateUserAccount(
    userId: string,
    action: 'approve' | 'disable' | 'set_pending' | 'set_role',
    role?: 'student' | 'writer' | 'admin'
  ) {
    setProcessingId(userId);
    try {
      const { data } = await axios.patch('/api/admin/users', { userId, action, role });
      const updated = data?.user as UserAccount | undefined;
      if (updated) {
        setUsersData((prevUsers) => {
          const previousUser = prevUsers.find((u) => u.id === userId);
          if (previousUser && previousUser.is_online !== updated.is_online) {
            setPresenceCounts((prevCounts) => {
              const nextOnlineUsers = Math.max(0, prevCounts.onlineUsers + (updated.is_online ? 1 : -1));
              return {
                onlineUsers: nextOnlineUsers,
                offlineUsers: Math.max(0, totalUsers - nextOnlineUsers),
              };
            });
          }
          return prevUsers.map((u) => (u.id === userId ? updated : u));
        });
      }
      setMessage(data?.message ?? 'User updated.');
    } catch (error) {
      console.error('Failed to update user account:', error);
      setMessage('Failed to update user account.');
    } finally {
      setProcessingId(null);
    }
  }

  async function decideSubmission(submissionId: string, decision: 'approve' | 'reject') {
    setProcessingId(submissionId);
    await axios.post('/api/admin/submissions/decision', { submissionId, decision });
    setMessage(`Submission ${decision}d.`);
    setProcessingId(null);
    // Optionally: reload page or refetch data
  }

  async function approveWithdrawal(transactionId: string) {
    setProcessingId(transactionId);
    await axios.post('/api/admin/withdrawals/approve', { transactionId });
    setMessage('Withdrawal approved.');
    setProcessingId(null);
    // Optionally: reload page or refetch data
  }

  // Use next/navigation for safe client-side query string manipulation
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildPageUrl(param: string, value: number) {
    if (!searchParams) return '#';
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set(param, String(value));
    return `${pathname}?${params.toString()}`;
  }

  useEffect(() => {
    setPaymentsData(payments);
  }, [payments]);

  useEffect(() => {
    const limit = pageSize;
    const offset = (payPage - 1) * pageSize;
    let cancelled = false;

    const refreshPayments = async () => {
      setIsRefreshingPayments(true);
      setPaymentsRefreshError(null);
      try {
        const { data } = await axios.get('/api/admin/payments', {
          params: { limit, offset, includePayouts: true },
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!cancelled) {
          const nextPayments = Array.isArray(data?.payments) ? data.payments : [];
          setPaymentsData(nextPayments);
        }
      } catch (error) {
        console.error('Failed to refresh payments:', error);
        if (!cancelled) {
          setPaymentsRefreshError('Unable to refresh payments right now.');
        }
      } finally {
        if (!cancelled) setIsRefreshingPayments(false);
      }
    };

    refreshPayments();
    const timer = window.setInterval(refreshPayments, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [payPage, pageSize]);

  return (
    <>
    <DashboardShell
      roleLabel="Admin"
      title="Admin Dashboard"
      subtitle="Review submissions and manage payments"
      navItems={navItems}
      headerRight={
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-emerald-700/70">Users</p>
            <p className="text-lg font-semibold text-emerald-950">{totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/30 px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-emerald-700/70">Online</p>
            <p className="text-lg font-semibold text-emerald-950">{presenceCounts.onlineUsers}</p>
          </div>
          <button className="btn-secondary" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Registered Users</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Toggle this section when needed so the rest of the dashboard stays visible.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <CircleDot className="h-3 w-3" /> Online: {presenceCounts.onlineUsers}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                <CircleDot className="h-3 w-3" /> Offline: {presenceCounts.offlineUsers}
              </span>
              <button
                className="btn-secondary"
                onClick={() => setShowUsersPanel((prev) => !prev)}
                aria-expanded={showUsersPanel}
                aria-controls="admin-users-panel"
              >
                {showUsersPanel ? 'Hide Users' : 'Show Users'}
              </button>
            </div>
          </div>

          {showUsersPanel ? (
            <>
              <div id="admin-users-panel" className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {usersData.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{user.display_name || 'Unnamed user'}</p>
                        <p className="text-sm text-[color:var(--muted)]">{user.email}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted)]">
                          Role: <span className="font-medium">{user.role}</span> | Approval: <span className="font-medium">{user.approval_status}</span>
                        </p>
                        <p className="text-xs text-[color:var(--muted)]">
                          {user.is_online ? 'Online now' : `Offline - Last seen ${user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'never'}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {user.approval_status !== 'approved' && (
                          <button className="btn-primary disabled:opacity-60" onClick={() => updateUserAccount(user.id, 'approve')} disabled={processingId === user.id}>
                            {processingId === user.id ? 'Updating...' : 'Approve'}
                          </button>
                        )}
                        {user.approval_status !== 'rejected' && (
                          <button className="btn-secondary disabled:opacity-60" onClick={() => updateUserAccount(user.id, 'disable')} disabled={processingId === user.id}>
                            {processingId === user.id ? 'Updating...' : 'Disable'}
                          </button>
                        )}
                        {user.approval_status !== 'pending' && (
                          <button className="btn-secondary disabled:opacity-60" onClick={() => updateUserAccount(user.id, 'set_pending')} disabled={processingId === user.id}>
                            {processingId === user.id ? 'Updating...' : 'Set Pending'}
                          </button>
                        )}
                        {user.role !== 'writer' && (
                          <button className="btn-secondary disabled:opacity-60" onClick={() => updateUserAccount(user.id, 'set_role', 'writer')} disabled={processingId === user.id}>
                            {processingId === user.id ? 'Updating...' : 'Make Writer'}
                          </button>
                        )}
                        {user.role !== 'student' && (
                          <button className="btn-secondary disabled:opacity-60" onClick={() => updateUserAccount(user.id, 'set_role', 'student')} disabled={processingId === user.id}>
                            {processingId === user.id ? 'Updating...' : 'Make Student'}
                          </button>
                        )}
                        {user.role !== 'admin' && (
                          <button className="btn-secondary disabled:opacity-60" onClick={() => updateUserAccount(user.id, 'set_role', 'admin')} disabled={processingId === user.id}>
                            {processingId === user.id ? 'Updating...' : 'Make Admin'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {usersData.length === 0 && <p className="text-sm text-[color:var(--muted)]">No users found.</p>}
              </div>

              {totalUsers > pageSize && (
                <div className="mt-4 flex justify-center">
                  {Array.from({ length: Math.ceil(totalUsers / pageSize) }, (_, i) => (
                    <a
                      key={i}
                      href={buildPageUrl('userPage', i + 1)}
                      className={`mx-1 rounded px-3 py-1 ${userPage === i + 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">Users list is hidden. Click "Show Users" when you need to manage accounts.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Task Submissions</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Review submissions and update status.</p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setShowSubmissionsPanel((prev) => !prev)}
              aria-expanded={showSubmissionsPanel}
              aria-controls="admin-submissions-panel"
            >
              {showSubmissionsPanel ? 'Hide Submissions' : 'Show Submissions'}
            </button>
          </div>

          {showSubmissionsPanel ? (
            <>
              <div id="admin-submissions-panel" className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{s.tasks?.assignments?.title ?? 'Assignment'}</p>
                        <p className="text-sm text-[color:var(--muted)]">Status: {s.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-secondary" onClick={() => setModal({ kind: 'submission', data: s })}>View</button>
                        <button className="btn-primary disabled:opacity-60" onClick={() => decideSubmission(s.id, 'approve')} disabled={processingId === s.id}>
                          {processingId === s.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button className="btn-secondary disabled:opacity-60" onClick={() => decideSubmission(s.id, 'reject')} disabled={processingId === s.id}>
                          {processingId === s.id ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                    <button
                      className="mt-2 inline-block text-sm text-[color:var(--primary)] underline disabled:opacity-60"
                      disabled={downloadingId === s.id}
                      onClick={async () => {
                        setDownloadingId(s.id);
                        try {
                          const { data } = await axios.post('/api/admin/submissions/signed-url', { storage_path: s.storage_path });
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank', 'noopener');
                          } else {
                            alert('Failed to get download link.');
                          }
                        } catch {
                          alert('Failed to get download link.');
                        } finally {
                          setDownloadingId(null);
                        }
                      }}
                    >
                      {downloadingId === s.id ? 'Preparing...' : 'Download submission'}
                    </button>
                  </div>
                ))}
                {submissions.length === 0 && <p className="text-sm text-[color:var(--muted)]">No submissions yet.</p>}
              </div>
              {totalSubmissions > pageSize && (
                <div className="flex justify-center mt-4">
                  {Array.from({ length: Math.ceil(totalSubmissions / pageSize) }, (_, i) => (
                    <a
                      key={i}
                      href={buildPageUrl('subPage', i + 1)}
                      className={`mx-1 px-3 py-1 rounded ${subPage === i + 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">Submissions list is hidden. Click "Show Submissions" when needed.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Payments</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Track all incoming payments. {isRefreshingPayments ? 'Refreshing...' : 'Auto-refreshes every 15s.'}</p>
              {paymentsRefreshError && <p className="mt-1 text-xs text-red-600">{paymentsRefreshError}</p>}
            </div>
            <button
              className="btn-secondary"
              onClick={() => setShowPaymentsPanel((prev) => !prev)}
              aria-expanded={showPaymentsPanel}
              aria-controls="admin-payments-panel"
            >
              {showPaymentsPanel ? 'Hide Payments' : 'Show Payments'}
            </button>
          </div>

          {showPaymentsPanel ? (
            <>
              <div id="admin-payments-panel" className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {paymentsData.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
                    <div>
                      <p className="font-medium">{p.type.toUpperCase()} • {p.currency} {p.amount}</p>
                      <p className="text-sm text-[color:var(--muted)]">Status: {p.status}</p>
                    </div>
                    <button className="btn-secondary" onClick={() => setModal({ kind: 'payment', data: p })}>View</button>
                  </div>
                ))}
                {paymentsData.length === 0 && <p className="text-sm text-[color:var(--muted)]">No payments yet.</p>}
              </div>
              {totalPayments > pageSize && (
                <div className="flex justify-center mt-4">
                  {Array.from({ length: Math.ceil(totalPayments / pageSize) }, (_, i) => (
                    <a
                      key={i}
                      href={buildPageUrl('payPage', i + 1)}
                      className={`mx-1 px-3 py-1 rounded ${payPage === i + 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">Payments list is hidden. Click "Show Payments" when needed.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Withdrawals</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Approve writer payout requests.</p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setShowWithdrawalsPanel((prev) => !prev)}
              aria-expanded={showWithdrawalsPanel}
              aria-controls="admin-withdrawals-panel"
            >
              {showWithdrawalsPanel ? 'Hide Withdrawals' : 'Show Withdrawals'}
            </button>
          </div>

          {showWithdrawalsPanel ? (
            <>
              <div id="admin-withdrawals-panel" className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
                    <div>
                      <p className="font-medium">KES {w.amount}</p>
                      <p className="text-sm text-[color:var(--muted)]">Status: {w.status}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary" onClick={() => setModal({ kind: 'payment', data: w })}>View</button>
                      {w.status !== 'success' && (
                        <button className="btn-primary disabled:opacity-60" onClick={() => approveWithdrawal(w.id)} disabled={processingId === w.id}>
                          {processingId === w.id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {withdrawals.length === 0 && <p className="text-sm text-[color:var(--muted)]">No withdrawal requests.</p>}
              </div>
              {totalWithdrawals > pageSize && (
                <div className="flex justify-center mt-4">
                  {Array.from({ length: Math.ceil(totalWithdrawals / pageSize) }, (_, i) => (
                    <a
                      key={i}
                      href={buildPageUrl('withPage', i + 1)}
                      className={`mx-1 px-3 py-1 rounded ${withPage === i + 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">Withdrawals list is hidden. Click "Show Withdrawals" when needed.</p>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-[color:var(--muted)]">{message}</p>}
    </DashboardShell>
    <Modal
      open={modal.kind !== 'none'}
      title={
        modal.kind === 'submission'
          ? 'Submission Details'
          : modal.kind === 'payment'
          ? 'Payment Details'
          : ''
      }
      onClose={() => setModal({ kind: 'none' })}
    >
      {modal.kind === 'submission' && (
        <div className="space-y-2">
          <div><span className="font-semibold">Assignment:</span> {modal.data.tasks?.assignments?.title ?? 'Assignment'}</div>
          <div><span className="font-semibold">Status:</span> {modal.data.status}</div>
          <div><span className="font-semibold">Notes:</span> {modal.data.notes ?? '—'}</div>
          <button
            className="text-[color:var(--primary)] underline disabled:opacity-60"
            disabled={downloadingId === modal.data.id}
            onClick={async () => {
              setDownloadingId(modal.data.id);
              try {
                const { data } = await axios.post('/api/admin/submissions/signed-url', { storage_path: modal.data.storage_path });
                if (data?.signedUrl) {
                  window.open(data.signedUrl, '_blank', 'noopener');
                } else {
                  alert('Failed to get download link.');
                }
              } catch {
                alert('Failed to get download link.');
              } finally {
                setDownloadingId(null);
              }
            }}
          >
            {downloadingId === modal.data.id ? 'Preparing...' : 'Download submission'}
          </button>
        </div>
      )}
      {modal.kind === 'payment' && (
        <div className="space-y-2">
          <div><span className="font-semibold">Type:</span> {modal.data.type}</div>
          <div><span className="font-semibold">Amount:</span> {modal.data.currency} {modal.data.amount}</div>
          <div><span className="font-semibold">Status:</span> {modal.data.status}</div>
          <div><span className="font-semibold">Reference:</span> {modal.data.reference ?? '—'}</div>
          <div><span className="font-semibold">Created:</span> {new Date(modal.data.created_at).toLocaleString()}</div>
        </div>
      )}
    </Modal>
    </>
  );
}
