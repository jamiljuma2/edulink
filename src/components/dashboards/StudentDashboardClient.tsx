"use client";
import { useEffect, useMemo, useState } from 'react';
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
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  async function loadWallet() {
    const { data } = await axios.get('/api/student/wallet');
    setWallet(Number(data?.wallet?.balance ?? 0));
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
    setMessage('Initiating M-Pesa STK push...');
    try {
      await axios.post('/api/payments/mpesa/topup', { amount, phone });
      setMessage('Check your phone to approve payment.');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.error ?? 'Top-up failed.');
      } else {
        setMessage('Top-up failed.');
      }
    }
  }

  async function topupGlobal() {
    setMessage('Redirecting to M-Pesa Global checkout...');
    const { data } = await axios.post('/api/payments/mpesa-global/topup', { amount });
    if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
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
    if (!file) {
      setMessage('Please choose a file to upload.');
      return;
    }
    setUploading(true);
    const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('assignments').upload(path, file);
    if (upErr) {
      setMessage(upErr.message);
      setUploading(false);
      return;
    }
    try {
      const { data } = await axios.post('/api/student/assignment', { title, description, storage_path: path });
      if (!data?.assignment) {
        setMessage('Failed to create assignment');
        setUploading(false);
        return;
      }
      setMessage('Assignment uploaded successfully.');
      setTitle('');
      setDescription('');
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
      subtitle="Manage assignments and payments"
      navItems={navItems}
      headerRight={
        <div className="flex items-center gap-3">
          <div className="card flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[color:var(--secondary)]" />
            <span className="text-sm font-semibold">${wallet.toFixed(2)}</span>
          </div>
          <button className="btn-secondary" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-xl font-semibold">Wallet Top-up</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Fund your wallet securely via M-Pesa or card.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone e.g. +254712345678" className="min-w-[220px] rounded border p-2" />
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-28 rounded border p-2" />
            <button onClick={topupKenya} className="btn-primary">M-Pesa (Kenya)</button>
            <button onClick={topupGlobal} className="btn-secondary">Card (Global)</button>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold">Upload Assignment</h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded border p-2" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="rounded border p-2" />
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
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-[color:var(--border)] p-3">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-[color:var(--muted)]">{a.status}</p>
              </div>
              <span className="text-xs text-[color:var(--muted)]">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-sm text-[color:var(--muted)]">No assignments yet.</p>}
        </div>
      </div>

      {message && <p className="text-sm text-[color:var(--muted)]">{message}</p>}
    </DashboardShell>
  );
}
