"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import axios from 'axios';
import { Wallet, UploadCloud, FileText, Bell } from 'lucide-react';
import DashboardShell, { NavItem } from '@/components/layouts/DashboardShell';

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  due_date?: string | null;
};

type StudentDashboardClientProps = {
  wallet: number;
  assignments: Assignment[];
  totalAssignments: number;
  page: number;
  pageSize: number;
};

export default function StudentDashboardClient({ wallet: walletProp, assignments, totalAssignments, page, pageSize }: StudentDashboardClientProps) {
  const navItems: NavItem[] = [
    { label: 'Overview', icon: FileText },
    { label: 'Assignments', icon: UploadCloud },
    { label: 'Wallet', icon: Wallet },
  ];
  const universitySubjects = [
    'Advanced Research Methods',
    'Applied Statistics',
    'Computer Networks',
    'Database Systems',
    'Machine Learning',
    'Software Engineering',
  ];
  const collegeSubjects = [
    'Academic Writing',
    'Business Communication',
    'Introduction to IT',
    'Project Management',
    'Study Skills',
    'Technical Report Writing',
  ];
  const supabase = useMemo(() => supabaseClient(), []);
  const [wallet, setWallet] = useState<number>(walletProp);
  const [amount, setAmount] = useState(5);
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [citationStyle, setCitationStyle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [pages, setPages] = useState(1);
  const [budget, setBudget] = useState(25);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [payingGlobal, setPayingGlobal] = useState(false);
  const [stkOverlayOpen, setStkOverlayOpen] = useState(false);
  const [stkReference, setStkReference] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
      // Keep wallet state in sync with prop if it changes (e.g. on reload)
      useEffect(() => {
        setWallet(walletProp);
      }, [walletProp]);
    // Load userId from supabase on mount
    useEffect(() => {
      (async () => {
        const { data } = await supabase.auth.getUser();
        setUserId(data.user?.id ?? null);
      })();
    }, [supabase]);
  const pollingRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);
  const lastWalletRef = useRef<number>(0);
  const messageTimeoutRef = useRef<number | null>(null);
  const stkStatusRef = useRef<number | null>(null);
  const stkOverlayTimeoutRef = useRef<number | null>(null);

  function stopWalletPolling() {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
    pollingRef.current = null;
    pollingTimeoutRef.current = null;
  }

  function stopStkStatusPolling() {
    if (stkStatusRef.current) window.clearInterval(stkStatusRef.current);
    stkStatusRef.current = null;
  }

  function startWalletPolling() {
    stopWalletPolling();
    pollingRef.current = window.setInterval(() => {
      loadWallet();
    }, 6000);
    pollingTimeoutRef.current = window.setTimeout(() => {
      stopWalletPolling();
      if (stkOverlayOpen) {
        setStkOverlayOpen(false);
        setMessage('Payment timed out or was cancelled. Please try again.');
      }
    }, 120000);
  }

  function getAxiosMessage(err: unknown, fallback: string) {
    if (axios.isAxiosError(err)) {
      if (!err.response) return 'Network error. Please check your connection and try again.';
      return err.response?.data?.error ?? fallback;
    }
    return fallback;
  }

  async function loadWallet() {
    try {
      const { data } = await axios.get('/api/student/wallet');
      const nextBalance = Number(data?.wallet?.balance ?? 0);
      setWallet(nextBalance);
      if (stkOverlayOpen && nextBalance > lastWalletRef.current) {
        setStkOverlayOpen(false);
        setMessage('Payment received. Wallet updated.');
      }
      lastWalletRef.current = nextBalance;
    } catch (err: unknown) {
      setMessage(getAxiosMessage(err, 'Unable to load wallet.'));
    }
  }

  // async function loadAssignments() {
  //   try {
  //     const { data } = await axios.get('/api/student/assignments');
  //     // setAssignments(data?.assignments ?? []); // assignments are props, not state
  //   } catch (err: unknown) {
  //     setMessage(getAxiosMessage(err, 'Unable to load assignments.'));
  //   }
  // }

  // Removed initial data loading effect; handled by server

  useEffect(() => {
    if (!message) return;
    if (messageTimeoutRef.current) window.clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimeoutRef.current = null;
    }, 5000);
    return () => {
      if (messageTimeoutRef.current) window.clearTimeout(messageTimeoutRef.current);
    };
  }, [message]);

  useEffect(() => {
    if (!stkOverlayOpen) return;
    if (stkOverlayTimeoutRef.current) window.clearTimeout(stkOverlayTimeoutRef.current);
    stkOverlayTimeoutRef.current = window.setTimeout(() => {
      setStkOverlayOpen(false);
      stkOverlayTimeoutRef.current = null;
    }, 3000);
    return () => {
      if (stkOverlayTimeoutRef.current) window.clearTimeout(stkOverlayTimeoutRef.current);
    };
  }, [stkOverlayOpen]);

  async function topupKenya() {
    if (!phone) {
      setMessage('Please enter your phone number.');
      return;
    }
    if (amount < 10) {
      setMessage('Minimum top-up is KES 10.');
      return;
    }
    setMessage(null);
    setStkOverlayOpen(true);
    setToppingUp(true);
    let initiated = false;
    try {
      const { data } = await axios.post('/api/payments/mpesa/topup', { amount, phone });
      initiated = true;
      setStkReference(data?.reference ?? null);
      setMessage('STK push sent. Check your phone to approve payment.');
      startWalletPolling();
      // Automatically reload page after top-up to sync wallet prop
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 3000); // Wait 3s for payment processing
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Top-up failed.');
      } else {
        setMessage('Top-up failed.');
      }
    } finally {
      setToppingUp(false);
      if (!initiated) setStkOverlayOpen(false);
    }
  }

  useEffect(() => {
    if (!stkReference || !stkOverlayOpen) return;
    stopStkStatusPolling();
    stkStatusRef.current = window.setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/payments/status?reference=${encodeURIComponent(stkReference)}`);
        const status = String(data?.transaction?.status ?? '').toLowerCase();
        if (status === 'completed' || status === 'success') {
          stopStkStatusPolling();
          setTimeout(() => {
            setStkOverlayOpen(false);
            setMessage('Payment received. Wallet updated.');
          }, 5000);
        }
        if (status === 'failed') {
          stopStkStatusPolling();
          setStkOverlayOpen(false);
          setMessage('Payment failed. Please try again.');
        }
      } catch {
        // ignore transient errors
      }
    }, 4000);
    return () => stopStkStatusPolling();
  }, [stkReference, stkOverlayOpen]);

  async function topupGlobal() {
    if (payingGlobal) return;
    setPayingGlobal(true);
    setMessage('Redirecting to PayPal checkout...');
    try {
      const { data } = await axios.post('/api/payments/mpesa-global/topup', { amount });
      if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'PayPal checkout failed.');
      } else {
        setMessage('PayPal checkout failed.');
      }
    } finally {
      setPayingGlobal(false);
    }
  }

  async function uploadAssignment() {
    setMessage(null);
    if (!userId) {
      setMessage('Please log in again.');
      return;
    }
    if (!title) {
      setMessage('Please add an assignment title.');
      return;
    }
    if (!dueDate) {
      setMessage('Please select a due date.');
      return;
    }
    if (!file) {
      setMessage('Please choose a file to upload.');
      return;
    }
    if (uploading) return;
    setUploading(true);
    const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('assignments').upload(path, file);
    if (upErr) {
      setMessage(upErr.message);
      setUploading(false);
      return;
    }
    try {
      const details = [
        subject ? `Subject: ${subject}` : null,
        citationStyle ? `Citation Style: ${citationStyle}` : null,
        pages ? `Pages: ${pages}` : null,
        budget ? `Budget: $${Number(budget).toFixed(2)}` : null,
      ].filter(Boolean);
      const descriptionText = description.trim();
      const descriptionWithMeta = details.length
        ? `${descriptionText ? `${descriptionText}\n\n` : ''}${details.join('\n')}`
        : descriptionText;

      const { data } = await axios.post('/api/student/assignment', {
        title,
        description: descriptionWithMeta || null,
        storage_path: path,
        due_date: dueDate,
      });
      if (!data?.assignment) {
        setMessage('Failed to create assignment');
        setUploading(false);
        return;
      }
      setMessage('Assignment uploaded successfully.');
      setTitle('');
      setSubject('');
      setCitationStyle('');
      setDescription('');
      setDueDate('');
      setPages(1);
      setBudget(25);
      setFile(null);
      setFileName('');
      // assignments are props, not state; no need to reload here
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Upload failed.');
      } else {
        setMessage('Upload failed.');
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardShell
      roleLabel="Student"
      title="Student Dashboard"
      subtitle="Manage assignments, payments, and submissions"
      navItems={navItems}
      headerRight={
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-emerald-200/40 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-emerald-700/70">Wallet</p>
                <p className="text-sm font-semibold text-emerald-900">KES {wallet.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <button className="btn-secondary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Wallet Top-up</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Fund your wallet securely via M-Pesa or card.</p>
            </div>
            <div className="rounded-full border border-emerald-200/40 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Instant STK confirmation
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Phone number</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Amount (KES)</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={topupKenya} disabled={toppingUp} className="btn-primary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:shadow-none disabled:transform-none">
              {toppingUp ? 'Processing...' : 'M-Pesa (Kenya)'}
            </button>
            <button onClick={topupGlobal} disabled={payingGlobal} className="btn-secondary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:shadow-none disabled:transform-none">
              {payingGlobal ? 'Opening PayPal...' : 'PayPal (Global)'}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">Quick Stats</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-white/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <FileText className="h-4 w-4 text-emerald-500" />
                Assignments
              </div>
              <span className="text-sm font-semibold text-slate-900">{assignments.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-white/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <UploadCloud className="h-4 w-4 text-sky-500" />
                Uploads
              </div>
              <span className="text-sm font-semibold text-slate-900">{assignments.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-white/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Wallet className="h-4 w-4 text-emerald-500" />
                Balance
              </div>
              <span className="text-sm font-semibold text-slate-900">KES {wallet.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Post New Assignment</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Fill in the details below to post your assignment and get matched with a writer.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium">Assignment Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Essay on Climate Change"
              className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Subject</span>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">Select subject</option>
                <optgroup label="University">
                  {universitySubjects.map((item) => (
                    <option key={`uni-${item}`} value={item}>{item}</option>
                  ))}
                </optgroup>
                <optgroup label="College">
                  {collegeSubjects.map((item) => (
                    <option key={`college-${item}`} value={item}>{item}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Citation Style (Optional)</span>
              <select
                value={citationStyle}
                onChange={(e) => setCitationStyle(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">Select style</option>
                <option value="APA">APA</option>
                <option value="MLA">MLA</option>
                <option value="Chicago">Chicago</option>
                <option value="Harvard">Harvard</option>
                <option value="IEEE">IEEE</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Description (Optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed instructions for your assignment..."
              className="mt-2 min-h-[120px] w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium">Deadline</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Pages</span>
              <input
                type="number"
                min={1}
                value={pages}
                onChange={(e) => setPages(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Budget ($)</span>
              <input
                type="number"
                min={1}
                step={0.01}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium shadow-sm">
              <span className="text-[color:var(--muted)]">Attachment</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Choose file</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  setFileName(selected?.name ?? '');
                }}
              />
            </label>
            {fileName && <span className="text-xs text-[color:var(--muted)]">Selected: {fileName}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setTitle('');
                setSubject('');
                setCitationStyle('');
                setDescription('');
                setDueDate('');
                setPages(1);
                setBudget(25);
                setFile(null);
                setFileName('');
              }}
              className="btn-secondary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:opacity-60 disabled:shadow-none disabled:transform-none"
              disabled={uploading}
            >
              Cancel
            </button>
            <button onClick={uploadAssignment} disabled={uploading} className="btn-primary transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:transform-none">
              {uploading ? 'Posting...' : 'Post Assignment'}
            </button>
          </div>
        </div>
      </div>


      <div className="card">
        <h2 className="text-xl font-semibold">My Assignments</h2>
        <div className="mt-3 space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-[color:var(--muted)]">{a.status}</p>
                {a.due_date && (
                  <p className="text-xs text-[color:var(--muted)]">Due: {new Date(a.due_date).toISOString().slice(0, 10)}</p>
                )}
              </div>
              <span className="text-xs text-[color:var(--muted)]">{new Date(a.created_at).toISOString().slice(0, 10)}</span>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-sm text-[color:var(--muted)]">No assignments yet.</p>}
          {/* Pagination controls */}
          {totalAssignments > pageSize && (
            <div className="flex justify-center mt-4">
              {Array.from({ length: Math.ceil(totalAssignments / pageSize) }, (_, i) => (
                <a
                  key={i}
                  href={`?page=${i + 1}`}
                  className={`mx-1 px-3 py-1 rounded ${page === i + 1 ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                >
                  {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {message && <p className="text-sm text-[color:var(--muted)]">{message}</p>}
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
      `}</style>
    </DashboardShell>
  );
}
