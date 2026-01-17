"use client";
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, Users, FileCheck2, Bell } from 'lucide-react';
import DashboardShell, { NavItem } from '@/components/layouts/DashboardShell';

type Profile = { id: string; email: string; display_name: string; role: string; approval_status: string };
type Submission = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  storage_path: string;
  signedUrl?: string | null;
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
  | { kind: 'approval'; data: Profile }
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

export default function AdminDashboardClient() {
    const navItems: NavItem[] = [
      { label: 'Approvals', icon: Users },
      { label: 'Submissions', icon: FileCheck2 },
      { label: 'Policies', icon: ShieldCheck },
    ];
  const [pending, setPending] = useState<Profile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    const { data } = await axios.get('/api/admin/approvals');
    setPending(data?.pending ?? []);
  }, []);

  const loadSubmissions = useCallback(async () => {
    const { data } = await axios.get('/api/admin/submissions');
    setSubmissions(data?.submissions ?? []);
  }, []);

  const loadPayments = useCallback(async () => {
    const { data } = await axios.get('/api/admin/payments');
    setPayments(data?.payments ?? []);
  }, []);

  const loadWithdrawals = useCallback(async () => {
    const { data } = await axios.get('/api/admin/withdrawals');
    setWithdrawals(data?.withdrawals ?? []);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPending(); loadSubmissions(); loadPayments(); loadWithdrawals(); }, [loadPending, loadSubmissions, loadPayments, loadWithdrawals]);

  async function approve(id: string) {
    setProcessingId(id);
    await axios.post('/api/admin/approvals/approve', { userId: id });
    setMessage('User approved');
    loadPending();
    setProcessingId(null);
  }

  async function decideSubmission(submissionId: string, decision: 'approve' | 'reject') {
    setProcessingId(submissionId);
    await axios.post('/api/admin/submissions/decision', { submissionId, decision });
    setMessage(`Submission ${decision}d.`);
    loadSubmissions();
    setProcessingId(null);
  }

  async function approveWithdrawal(transactionId: string) {
    setProcessingId(transactionId);
    await axios.post('/api/admin/withdrawals/approve', { transactionId });
    setMessage('Withdrawal approved.');
    loadWithdrawals();
    setProcessingId(null);
  }

  return (
    <>
    <DashboardShell
      roleLabel="Admin"
      title="Admin Dashboard"
      subtitle="Approve users and review submissions"
      navItems={navItems}
      headerRight={
        <div className="flex items-center gap-3">
          <div className="card">
            <p className="text-sm text-[color:var(--muted)]">Pending approvals</p>
            <p className="text-lg font-semibold">{pending.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-[color:var(--muted)]">Submissions</p>
            <p className="text-lg font-semibold">{submissions.length}</p>
          </div>
          <div className="card">
            <p className="text-sm text-[color:var(--muted)]">Payments</p>
            <p className="text-lg font-semibold">{payments.length}</p>
          </div>
          <button className="btn-secondary" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="card">
        <h2 className="text-xl font-semibold">Pending Approvals</h2>
        <div className="mt-3 space-y-2">
          {pending.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] p-3">
              <div>
                <p className="font-medium">{p.display_name} ({p.role})</p>
                <p className="text-sm text-[color:var(--muted)]">{p.email}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => setModal({ kind: 'approval', data: p })}>View</button>
                <button className="btn-primary disabled:opacity-60" onClick={() => approve(p.id)} disabled={processingId === p.id}>
                  {processingId === p.id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-[color:var(--muted)]">No pending approvals.</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold">Task Submissions</h2>
        <div className="mt-3 space-y-2">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-2xl border border-[color:var(--border)] p-3">
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
              {s.signedUrl && (
                <a className="mt-2 inline-block text-sm text-[color:var(--primary)] underline" href={s.signedUrl} target="_blank" rel="noreferrer">
                  Download submission
                </a>
              )}
            </div>
          ))}
          {submissions.length === 0 && <p className="text-sm text-[color:var(--muted)]">No submissions yet.</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold">Payments</h2>
        <div className="mt-3 space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] p-3">
              <div>
                <p className="font-medium">{p.type.toUpperCase()} • {p.currency} {p.amount}</p>
                <p className="text-sm text-[color:var(--muted)]">Status: {p.status}</p>
              </div>
              <button className="btn-secondary" onClick={() => setModal({ kind: 'payment', data: p })}>View</button>
            </div>
          ))}
          {payments.length === 0 && <p className="text-sm text-[color:var(--muted)]">No payments yet.</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold">Withdrawals</h2>
        <div className="mt-3 space-y-2">
          {withdrawals.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] p-3">
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
      </div>

      {message && <p className="text-sm text-[color:var(--muted)]">{message}</p>}
    </DashboardShell>
    <Modal
      open={modal.kind !== 'none'}
      title={
        modal.kind === 'approval'
          ? 'Approval Details'
          : modal.kind === 'submission'
          ? 'Submission Details'
          : modal.kind === 'payment'
          ? 'Payment Details'
          : ''
      }
      onClose={() => setModal({ kind: 'none' })}
    >
      {modal.kind === 'approval' && (
        <div className="space-y-2">
          <div><span className="font-semibold">Name:</span> {modal.data.display_name}</div>
          <div><span className="font-semibold">Email:</span> {modal.data.email}</div>
          <div><span className="font-semibold">Role:</span> {modal.data.role}</div>
          <div><span className="font-semibold">Status:</span> {modal.data.approval_status}</div>
        </div>
      )}
      {modal.kind === 'submission' && (
        <div className="space-y-2">
          <div><span className="font-semibold">Assignment:</span> {modal.data.tasks?.assignments?.title ?? 'Assignment'}</div>
          <div><span className="font-semibold">Status:</span> {modal.data.status}</div>
          <div><span className="font-semibold">Notes:</span> {modal.data.notes ?? '—'}</div>
          {modal.data.signedUrl && (
            <a className="text-[color:var(--primary)] underline" href={modal.data.signedUrl} target="_blank" rel="noreferrer">
              Download submission
            </a>
          )}
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
