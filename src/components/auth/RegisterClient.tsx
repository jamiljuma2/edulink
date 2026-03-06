"use client";

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebaseClient';
import { UserRole } from '@/lib/roles';

export default function RegisterClient() {
  const params = useSearchParams();
  const router = useRouter();
  const roleFromQuery = params.get('role') as UserRole | null;
  const [role, setRole] = useState<UserRole>(roleFromQuery ?? 'student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const auth = useMemo(() => getFirebaseAuth(), []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      const idToken = await credential.user.getIdToken(true);
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role, displayName: name, email }),
      });
      if (!registerRes.ok) {
        const detail = await registerRes.json().catch(() => ({}));
        throw new Error(detail?.error ?? 'Registration failed.');
      }
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        const detail = await sessionRes.json().catch(() => ({}));
        throw new Error(detail?.error ?? 'Unable to start session.');
      }
      setOk('Account created. Redirecting to your dashboard...');
      setTimeout(() => {
        if (role === 'student') router.replace('/student/dashboard');
        else router.replace('/writer/dashboard');
      }, 300);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const displayName = credential.user.displayName ?? name;
      const emailAddress = credential.user.email ?? email;
      if (!displayName) {
        throw new Error('Google account is missing a display name.');
      }
      if (!emailAddress) {
        throw new Error('Google account is missing an email.');
      }
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role, displayName, email: emailAddress }),
      });
      if (!registerRes.ok) {
        const detail = await registerRes.json().catch(() => ({}));
        throw new Error(detail?.error ?? 'Registration failed.');
      }
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        const detail = await sessionRes.json().catch(() => ({}));
        throw new Error(detail?.error ?? 'Unable to start session.');
      }
      setOk('Account created. Redirecting to your dashboard...');
      setTimeout(() => {
        if (role === 'student') router.replace('/student/dashboard');
        else router.replace('/writer/dashboard');
      }, 300);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-up failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-[color:var(--border)] bg-white/90 p-8 shadow-xl backdrop-blur">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-emerald-600">EduLink Writers</p>
            <h1 className="text-2xl font-semibold">Create your account</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Join as a student or writer in minutes.</p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full rounded-full border border-emerald-200 bg-white px-4 py-2.5 font-semibold text-emerald-700 shadow-sm hover:border-emerald-300 disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Continue with Google'}
            </button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Or register with email
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
          <form onSubmit={handleRegister} className="space-y-4" aria-busy={loading}>
            <label className="block">
              <span className="text-sm">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 form-input-clear"
                disabled={loading}
              >
                <option value="student">Student</option>
                <option value="writer">Writer</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm">Full Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 form-input-clear"
                autoComplete="name"
                disabled={loading}
                required
                placeholder="Jane Doe"
              />
            </label>
            <label className="block">
              <span className="text-sm">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 form-input-clear"
                autoComplete="email"
                disabled={loading}
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="text-sm">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 form-input-clear"
                autoComplete="new-password"
                disabled={loading}
                required
                placeholder="Create a strong password"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {ok && <p className="text-sm text-emerald-600">{ok}</p>}
            <button
              disabled={loading}
              className="w-full rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>
        </div>
      </div>
      <style jsx>{`
        .form-input-clear {
          border-width: 2px !important;
          background-color: #ffffff !important;
        }
        .form-input-clear::placeholder {
          color: #64748b !important;
        }
        .form-input-clear:focus {
          border-color: #34d399 !important;
        }
      `}</style>
    </div>
  );
}
