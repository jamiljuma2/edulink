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

export default function StudentDashboardClient() {
    const navItems: NavItem[] = [
      { label: 'Overview', icon: FileText },
      { label: 'Assignments', icon: UploadCloud },
      { label: 'Wallet', icon: Wallet },
    ];
  const supabase = useMemo(() => supabaseClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<number>(0);
  const [amount, setAmount] = useState(5);
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [payingGlobal, setPayingGlobal] = useState(false);
  const [stkOverlayOpen, setStkOverlayOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const pollingRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);
  const lastWalletRef = useRef<number>(0);

  function stopWalletPolling() {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
    pollingRef.current = null;
    pollingTimeoutRef.current = null;
  }

  function startWalletPolling() {
    stopWalletPolling();
    pollingRef.current = window.setInterval(() => {
      loadWallet();
    }, 6000);
    pollingTimeoutRef.current = window.setTimeout(() => {
      stopWalletPolling();
    }, 120000);
  }

  async function loadWallet() {
    const { data } = await axios.get('/api/student/wallet');
    const nextBalance = Number(data?.wallet?.balance ?? 0);
    setWallet(nextBalance);
    if (stkOverlayOpen && nextBalance > lastWalletRef.current) {
      setStkOverlayOpen(false);
      setMessage('Payment received. Wallet updated.');
    }
    lastWalletRef.current = nextBalance;
  }

  async function loadAssignments() {
    const { data } = await axios.get('/api/student/assignments');
    setAssignments(data?.assignments ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        await Promise.all([loadWallet(), loadAssignments()]);
      }
    })();
    return () => stopWalletPolling();
  }, [supabase]);

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
      await axios.post('/api/payments/mpesa/topup', { amount, phone });
      initiated = true;
      setMessage('STK push sent. Check your phone to approve payment.');
      startWalletPolling();
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
    if (!title || !description) {
      setMessage('Please add title and description.');
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
      const { data } = await axios.post('/api/student/assignment', { title, description, storage_path: path, due_date: dueDate });
      if (!data?.assignment) {
        setMessage('Failed to create assignment');
        setUploading(false);
        return;
      }
      setMessage('Assignment uploaded successfully.');
      setTitle('');
      setDescription('');
      setDueDate('');
      setFile(null);
      setFileName('');
      await loadAssignments();
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
          <button className="btn-secondary" aria-label="Notifications">
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
            <button onClick={topupKenya} disabled={toppingUp} className="btn-primary disabled:opacity-60">
              {toppingUp ? 'Processing...' : 'M-Pesa (Kenya)'}
            </button>
            <button onClick={topupGlobal} disabled={payingGlobal} className="btn-secondary disabled:opacity-60">
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
        <h2 className="text-xl font-semibold">Upload Assignment</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Add clear details so writers understand your requirements.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-200 lg:col-span-2" />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <div className="flex flex-col gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100">
              Choose file
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
          <div className="lg:col-span-3">
            <button onClick={uploadAssignment} disabled={uploading} className="btn-primary disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Upload'}
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
                  <p className="text-xs text-[color:var(--muted)]">Due: {new Date(a.due_date).toLocaleDateString()}</p>
                )}
              </div>
              <span className="text-xs text-[color:var(--muted)]">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-sm text-[color:var(--muted)]">No assignments yet.</p>}
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
