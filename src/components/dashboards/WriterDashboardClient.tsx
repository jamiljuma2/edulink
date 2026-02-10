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

type EarningTask = {
  id: string;
  created_at: string;
  assignments?: { title: string | null } | null;
};

type Submission = {
  id: string;
  task_id: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type WriterDashboardClientProps = {
  hasSubscription: boolean;
  plan: any;
  tasksPerDay: any;
  openAssignments: any[];
  totalOpenAssignments: number;
  page: number;
  pageSize: number;
  myTasks: any[];
  submissions: { id: any; task_id: any; status: any; notes: any; created_at: any; }[];
  earningTasks: any[];
  approvedTasks: number;
  taskRate: number;
  availableEarnings: number;
};

export default function WriterDashboardClient(props: WriterDashboardClientProps) {
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
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [stkOverlayOpen, setStkOverlayOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [availableEarnings, setAvailableEarnings] = useState<number>(0);
  const [approvedTasks, setApprovedTasks] = useState<number>(0);
  const [taskRate, setTaskRate] = useState<number>(0);
  const [earningTasks, setEarningTasks] = useState<EarningTask[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeButtons, setActiveButtons] = useState<Record<string, string | null>>({});
  const stkTimeoutRef = useMemo(() => ({ id: null as number | null }), []);
  const stkOverlayTimeoutRef = useMemo(() => ({ id: null as number | null }), []);
  const submissionByTask = useMemo(() => {
    const map: Record<string, Submission> = {};
    submissions.forEach((s) => {
      if (!map[s.task_id]) map[s.task_id] = s;
    });
    return map;
  }, [submissions]);

  function setActive(group: string, id: string, persist = true) {
    setActiveButtons((prev) => ({ ...prev, [group]: id }));
    if (!persist) {
      window.setTimeout(() => {
        setActiveButtons((prev) => (prev[group] === id ? { ...prev, [group]: null } : prev));
      }, 180);
    }
  }

  function isActive(group: string, id: string) {
    return activeButtons[group] === id;
  }

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
      type WriterDashboardClientProps = {
        hasSubscription: boolean;
        plan: string | null;
        tasksPerDay: number;
        openAssignments: Assignment[];
        totalOpenAssignments: number;
        page: number;
        pageSize: number;
        myTasks: Task[];
        submissions: Submission[];
        earningTasks: EarningTask[];
        approvedTasks: number;
        taskRate: number;
        availableEarnings: number;
      };
  }

  async function loadOpenAssignments() {
    const { data } = await axios.get('/api/writer/assignments');
    setOpenAssignments(data?.assignments ?? []);
  }

  async function loadMyTasks() {
    const { data } = await axios.get('/api/writer/tasks');
    setMyTasks(data?.tasks ?? []);
  }

  async function loadSubmissions() {
    const { data } = await axios.get('/api/writer/submissions');
    setSubmissions(data?.submissions ?? []);
  }

  async function loadEarnings() {
    const { data } = await axios.get('/api/writer/earnings');
    setAvailableEarnings(Number(data?.availableEarnings ?? 0));
    setApprovedTasks(Number(data?.approvedTasks ?? 0));
    setTaskRate(Number(data?.taskRate ?? 0));
    setEarningTasks(data?.tasks ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      await Promise.all([loadSummary(), loadOpenAssignments(), loadMyTasks(), loadSubmissions(), loadEarnings()]);
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
    if (paying) return;
    setPaying(true);
    setStkOverlayOpen(true);
    if (stkTimeoutRef.id) window.clearTimeout(stkTimeoutRef.id);
    if (stkOverlayTimeoutRef.id) window.clearTimeout(stkOverlayTimeoutRef.id);
    try {
      await axios.post('/api/subscriptions/pay', { subscriptionId, phone: payPhone });
      setMessage('Payment initiated. Complete the STK push on your phone.');
      setPayOpen(false);
      stkOverlayTimeoutRef.id = window.setTimeout(() => {
        setStkOverlayOpen(false);
        stkOverlayTimeoutRef.id = null;
      }, 3000);
      stkTimeoutRef.id = window.setTimeout(() => {
        setStkOverlayOpen(false);
        setMessage('Payment timed out or was cancelled. Please try again.');
        stkTimeoutRef.id = null;
      }, 120000);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Payment initiation failed.');
      } else {
        setMessage('Payment initiation failed.');
      }
      setStkOverlayOpen(false);
    } finally {
      setPaying(false);
    }
  }

  async function acceptAssignment(id: string) {
    setMessage(null);
    setActive('assignments', id);
    setAcceptingId(id);
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
    } finally {
      setAcceptingId(null);
      setActiveButtons((prev) => (prev.assignments === id ? { ...prev, assignments: null } : prev));
    }
  }

  async function submitTask(taskId: string) {
    setMessage(null);
    setActive('tasks', taskId);
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
      await Promise.all([loadMyTasks(), loadSubmissions()]);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Submission failed.');
      } else {
        setMessage('Submission failed.');
      }
    } finally {
      setSubmittingTaskId(null);
      setActiveButtons((prev) => (prev.tasks === taskId ? { ...prev, tasks: null } : prev));
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
          <button
            className={`btn-primary btn-pressable ${isActive('header', 'withdraw') ? 'active' : ''}`}
            onClick={() => {
              setActive('header', 'withdraw');
              setWithdrawAmount(Math.max(availableEarnings, 0));
              setWithdrawOpen(true);
            }}
          >
            Withdraw
          </button>
          <button
            className={`btn-secondary btn-pressable ${isActive('header', 'notifications') ? 'active' : ''}`}
            aria-label="Notifications"
            onClick={() => setActive('header', 'notifications', false)}
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Earnings available for withdrawal</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Based on approved tasks ready for payout.</p>
          </div>
          <div className="rounded-full border border-emerald-200/50 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Approved tasks: {approvedTasks}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
            <p className="text-xs uppercase tracking-widest text-emerald-600/70">Available earnings</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">KES {availableEarnings.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
            <p className="text-xs uppercase tracking-widest text-emerald-600/70">Rate per task</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">KES {taskRate.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
            <p className="text-xs uppercase tracking-widest text-emerald-600/70">Tasks ready</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{approvedTasks}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {earningTasks.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <div>
                <p className="font-medium">{task.assignments?.title ?? 'Approved task'}</p>
                <p className="text-xs text-[color:var(--muted)]">Approved on {new Date(task.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-700">KES {taskRate.toFixed(2)}</span>
            </div>
          ))}
          {earningTasks.length === 0 && (
            <p className="text-sm text-[color:var(--muted)]">No approved tasks ready for withdrawal yet.</p>
          )}
        </div>
      </div>
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
                <button
                  onClick={() => {
                    setActive('plans', key);
                    subscribe(key as SubscriptionPlan);
                  }}
                  className={`btn-primary btn-pressable mt-3 ${isActive('plans', key) ? 'active' : ''}`}
                >
                  Choose
                </button>
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
              <button
                className={`btn-secondary btn-pressable ${isActive('pay-modal', 'close') ? 'active' : ''}`}
                onClick={() => {
                  setActive('pay-modal', 'close', false);
                  setPayOpen(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="text-sm text-[color:var(--muted)]">Amount: KES {payAmount ?? '—'}</div>
              <input
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
                placeholder="Phone e.g. +254712345678"
                className="w-full rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={() => {
                  setActive('pay-modal', 'pay');
                  submitPayment();
                }}
                disabled={paying}
                className={`btn-primary btn-pressable w-full disabled:opacity-60 ${isActive('pay-modal', 'pay') ? 'active' : ''}`}
              >
                {paying ? 'Processing...' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Withdraw Earnings</h3>
              <button
                className={`btn-secondary btn-pressable ${isActive('withdraw-modal', 'close') ? 'active' : ''}`}
                onClick={() => {
                  setActive('withdraw-modal', 'close', false);
                  setWithdrawOpen(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="text-sm text-[color:var(--muted)]">Available: KES {availableEarnings.toFixed(2)}</div>
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
                  setActive('withdraw-modal', 'submit');
                  if (withdrawing) return;
                  if (availableEarnings <= 0 || withdrawAmount <= 0) {
                    setMessage('No approved earnings available for withdrawal.');
                    return;
                  }
                  setWithdrawing(true);
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
                  } finally {
                    setWithdrawing(false);
                  }
                }}
                className={`btn-primary btn-pressable w-full disabled:opacity-60 ${isActive('withdraw-modal', 'submit') ? 'active' : ''}`}
                disabled={withdrawing}
              >
                {withdrawing ? 'Submitting...' : 'Submit Withdrawal'}
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
              <button
                onClick={() => acceptAssignment(a.id)}
                disabled={acceptingId === a.id}
                className={`btn-primary btn-pressable disabled:opacity-60 ${isActive('assignments', a.id) ? 'active' : ''}`}
              >
                {acceptingId === a.id ? 'Accepting...' : 'Accept'}
              </button>
            </div>
          ))}
          {openAssignments.length === 0 && <p className="text-sm text-[color:var(--muted)]">No open assignments right now.</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold">My Tasks</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Submit completed work for admin review.</p>
        <div className="mt-4 space-y-3">
          {myTasks.map((t) => {
            const latestSubmission = submissionByTask[t.id];
            const canSubmit = ['accepted', 'working', 'rejected'].includes(t.status);
            return (
              <div key={t.id} className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t.assignments?.title ?? 'Assignment'}</p>
                  <span className="badge-pending">{t.status}</span>
                </div>
                {t.assignments?.due_date && (
                  <p className="mt-1 text-xs text-[color:var(--muted)]">Due: {new Date(t.assignments.due_date).toLocaleDateString()}</p>
                )}
                {latestSubmission?.status === 'rejected' && (
                  <div className="mt-3 rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-sm text-rose-800">
                    <p className="font-semibold">Submission rejected.</p>
                    <p className="text-xs text-rose-700/80">{latestSubmission?.notes || 'No admin notes provided.'}</p>
                  </div>
                )}
                {t.status === 'submitted' && (
                  <p className="mt-3 text-sm text-[color:var(--muted)]">Submission pending admin review.</p>
                )}
                {t.status === 'approved' && (
                  <p className="mt-3 text-sm text-emerald-700">Approved. Added to your earnings.</p>
                )}
                {canSubmit && (
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
                    <button
                      onClick={() => submitTask(t.id)}
                      className={`btn-primary btn-pressable ${isActive('tasks', t.id) ? 'active' : ''}`}
                    >
                      {submittingTaskId === t.id ? 'Submitting...' : latestSubmission?.status === 'rejected' ? 'Resubmit Work' : 'Submit Completed Work'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {myTasks.length === 0 && <p className="text-sm text-[color:var(--muted)]">No tasks yet.</p>}
        </div>
      </div>

      {message && (
        <div className="fixed top-6 left-1/2 z-[9999] w-[90%] max-w-lg -translate-x-1/2">
          <div className="rounded-2xl border border-emerald-200/60 bg-white px-4 py-3 text-center text-sm text-slate-700 shadow-lg">
            {message}
          </div>
        </div>
      )}
      {stkOverlayOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-6">
          <div className="stk-fade w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Check your phone — an M-Pesa prompt has been sent. Enter your PIN to complete payment.</h3>
            <div className="mt-5 flex justify-center">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stk-fade { animation: fadeIn 180ms ease-out; }
        .btn-pressable {
          transition: transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease, color 120ms ease;
          transform: translateZ(0);
        }
        @media (hover: hover) {
          .btn-pressable:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
          }
        }
        .btn-pressable:active {
          transform: scale(0.97);
        }
        .btn-pressable.active {
          background-color: #0f172a !important;
          color: #ffffff !important;
          transform: scale(0.98);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        }
      `}</style>
    </DashboardShell>
  );
}
