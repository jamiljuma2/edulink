"use client";
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/lib/roles';
import { supabaseClient } from '@/lib/supabaseClient';
import { FileCheck, Briefcase, Wallet, Bell } from 'lucide-react';
import DashboardShell, { NavItem } from '@/components/layouts/DashboardShell';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  due_date?: string | null;
};

type Task = {
  id: string;
  status: string;
  assignments?: Assignment | null;
};

export default function WriterDashboardClient() {
    const navItems: NavItem[] = [
      { label: 'Overview', icon: Briefcase },
      { label: 'Assignments', icon: FileCheck },
      { label: 'Subscriptions', icon: Wallet },
    ];
  const supabase = useMemo(() => supabaseClient(), []);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [tasksPerDay, setTasksPerDay] = useState<number>(0);
  const [tasksToday, setTasksToday] = useState<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [openAssignments, setOpenAssignments] = useState<Assignment[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [taskFiles, setTaskFiles] = useState<Record<string, File | null>>({});
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [payOpen, setPayOpen] = useState(false);
  const [payPhone, setPayPhone] = useState('');
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawPhone, setWithdrawPhone] = useState('');

  async function loadSummary() {
    const { data } = await axios.get('/api/writer/tasks/summary');
    if (data?.hasSubscription) {
      setActivePlan(data.plan);
      setTasksPerDay(Number(data.tasksPerDay ?? 0));
      setTasksToday(Number(data.tasksToday ?? 0));
      setRemaining(data.remaining ?? null);
    } else {
      setActivePlan(null);
      setTasksPerDay(0);
      setTasksToday(0);
      setRemaining(null);
    }
  }

  async function loadOpenAssignments() {
    const { data } = await axios.get('/api/writer/assignments');
    setOpenAssignments(data?.assignments ?? []);
  }

  async function loadMyTasks() {
    const { data } = await axios.get('/api/writer/tasks');
    setMyTasks(data?.tasks ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      await Promise.all([loadSummary(), loadOpenAssignments(), loadMyTasks()]);
    })();
  }, [supabase]);

  async function subscribe(plan: SubscriptionPlan) {
    const { data } = await axios.post('/api/subscriptions/checkout', { plan });
    setSubscriptionId(data?.subscriptionId ?? null);
    setPayAmount(data?.amount ?? null);
    setPayOpen(true);
  }

  async function submitPayment() {
    if (!subscriptionId) {
      setMessage('Subscription not found. Please choose a plan again.');
      return;
    }
    if (!payPhone) {
      setMessage('Please enter your phone number to continue.');
      return;
    }
    try {
      await axios.post('/api/subscriptions/pay', { subscriptionId, phone: payPhone });
      setMessage('Payment initiated. Complete the STK push on your phone.');
      setPayOpen(false);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Payment initiation failed.');
      } else {
        setMessage('Payment initiation failed.');
      }
    }
  }

  async function acceptAssignment(id: string) {
    setMessage(null);
    try {
      await axios.post('/api/writer/tasks/accept', { assignmentId: id });
      await Promise.all([loadOpenAssignments(), loadMyTasks(), loadSummary()]);
      setMessage('Assignment accepted.');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Failed to accept assignment');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to accept assignment';
        setMessage(message);
      }
    }
  }

  async function submitTask(taskId: string) {
    setMessage(null);
    const file = taskFiles[taskId];
    if (!file || !userId) {
      setMessage('Please attach a file before submitting.');
      return;
    }
    setSubmittingTaskId(taskId);
    const path = `${userId}/${taskId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('submissions').upload(path, file);
    if (upErr) {
      setMessage(upErr.message);
      setSubmittingTaskId(null);
      return;
    }
    try {
      await axios.post('/api/writer/tasks/submit', {
        taskId,
        storagePath: path,
        notes: taskNotes[taskId] ?? '',
      });
      setMessage('Submission uploaded. Awaiting admin review.');
      await loadMyTasks();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Submission failed.');
      } else {
        setMessage('Submission failed.');
      }
    } finally {
      setSubmittingTaskId(null);
    }
    setTaskFiles((prev) => ({ ...prev, [taskId]: null }));
    setTaskNotes((prev) => ({ ...prev, [taskId]: '' }));
  }

  return (
    <DashboardShell
      roleLabel="Writer"
      title="Writer Dashboard"
      subtitle="Manage tasks, subscriptions, and payouts"
      navItems={navItems}
      headerRight={
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Briefcase className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-indigo-700/70">Daily capacity</p>
                <p className="text-sm font-semibold text-indigo-900">{tasksPerDay === 0 ? 'Unlimited' : `${remaining ?? 0} left`}</p>
              </div>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setWithdrawOpen(true)}>Withdraw</button>
          <button className="btn-secondary" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Subscription</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Choose a plan that matches your daily workload.</p>
          </div>
          <div className="rounded-full border border-indigo-200/50 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Auto-activates on payment
          </div>
        </div>
        {activePlan ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <p className="text-xs uppercase tracking-widest text-indigo-600/70">Active plan</p>
              <p className="mt-2 text-lg font-semibold capitalize text-slate-900">{activePlan}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <p className="text-xs uppercase tracking-widest text-indigo-600/70">Tasks/day</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{tasksPerDay === 0 ? 'Unlimited' : tasksPerDay}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <p className="text-xs uppercase tracking-widest text-indigo-600/70">Completed</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{tasksToday}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <p className="text-xs uppercase tracking-widest text-indigo-600/70">Remaining</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{tasksPerDay === 0 ? 'Unlimited' : remaining ?? 0}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(SUBSCRIPTION_PLANS).map(([key, v]) => (
              <div key={key} className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4 shadow-sm">
                <h3 className="text-lg font-semibold capitalize text-slate-900">{key}</h3>
                <p className="mt-1 text-sm text-[color:var(--muted)]">${v.price}/month • {v.tasksPerDay === Infinity ? 'Unlimited' : v.tasksPerDay} tasks/day</p>
                <button onClick={() => subscribe(key as SubscriptionPlan)} className="btn-primary mt-3">Choose</button>
              </div>
            ))}
          </div>
        )}
      </div>


      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Complete Subscription Payment</h3>
              <button className="btn-secondary" onClick={() => setPayOpen(false)}>Close</button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="text-sm text-[color:var(--muted)]">Amount: KES {payAmount ?? '—'}</div>
              <input
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="Phone e.g. +254712345678"
                className="w-full rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button onClick={submitPayment} className="btn-primary w-full">Pay Now</button>
            </div>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Withdraw Earnings</h3>
              <button className="btn-secondary" onClick={() => setWithdrawOpen(false)}>Close</button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                placeholder="Amount (KES)"
                className="w-full rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                value={withdrawPhone}
                onChange={(e) => setWithdrawPhone(e.target.value)}
                placeholder="Phone e.g. +254712345678"
                className="w-full rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={async () => {
                  try {
                    await axios.post('/api/writer/withdrawals', { amount: withdrawAmount, phone: withdrawPhone });
                    setMessage('Withdrawal request submitted.');
                    setWithdrawOpen(false);
                  } catch (err: unknown) {
                    if (axios.isAxiosError(err)) {
                      setMessage(err.response?.data?.error ?? 'Withdrawal failed.');
                    } else {
                      setMessage('Withdrawal failed.');
                    }
                  }
                }}
                className="btn-primary w-full"
              >
                Submit Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <h2 className="text-xl font-semibold">Available Assignments</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Pick new tasks that match your expertise.</p>
        <div className="mt-4 space-y-3">
          {openAssignments.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-[color:var(--muted)]">{a.description}</p>
                {a.due_date && (
                  <p className="text-xs text-[color:var(--muted)]">Due: {new Date(a.due_date).toLocaleDateString()}</p>
                )}
              </div>
              <button onClick={() => acceptAssignment(a.id)} className="btn-primary">Accept</button>
            </div>
          ))}
          {openAssignments.length === 0 && <p className="text-sm text-[color:var(--muted)]">No open assignments right now.</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold">My Tasks</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Submit completed work for admin review.</p>
        <div className="mt-4 space-y-3">
          {myTasks.map((t) => (
            <div key={t.id} className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{t.assignments?.title ?? 'Assignment'}</p>
                <span className="badge-pending">{t.status}</span>
              </div>
              {t.assignments?.due_date && (
                <p className="mt-1 text-xs text-[color:var(--muted)]">Due: {new Date(t.assignments.due_date).toLocaleDateString()}</p>
              )}
              {t.status !== 'approved' && (
                <div className="mt-3 grid gap-2">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100">
                    Choose file
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setTaskFiles((prev) => ({ ...prev, [t.id]: e.target.files?.[0] ?? null }))}
                    />
                  </label>
                  <textarea
                    className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Notes for admin (optional)"
                    value={taskNotes[t.id] ?? ''}
                    onChange={(e) => setTaskNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  />
                  <button onClick={() => submitTask(t.id)} className="btn-primary">
                    {submittingTaskId === t.id ? 'Submitting...' : 'Submit Completed Work'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {myTasks.length === 0 && <p className="text-sm text-[color:var(--muted)]">No tasks yet.</p>}
        </div>
      </div>

      {message && <p className="text-sm text-[color:var(--muted)]">{message}</p>}
    </DashboardShell>
  );
}
