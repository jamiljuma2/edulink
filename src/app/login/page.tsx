"use client";
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebaseClient';
import type { UserRole } from '@/lib/roles';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [profileRole, setProfileRole] = useState<UserRole>('student');
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileToken, setProfileToken] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);
  const router = useRouter();
  const auth = useMemo(() => getFirebaseAuth(), []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        const detail = await sessionRes.json().catch(() => ({}));
        throw new Error(detail?.error ?? 'Unable to start session.');
      }
      const sessionData = await sessionRes.json().catch(() => ({}));
      const profile = sessionData?.profile ?? null;
      if (!profile) {
        const displayName = credential.user.displayName ?? credential.user.email ?? '';
        setProfileName(displayName);
        setProfileEmail(credential.user.email ?? '');
        setProfileToken(idToken);
        setNeedsProfile(true);
        return;
      }
      const role = profile?.role ?? null;
      if (role === 'student') router.replace('/student/dashboard');
      else if (role === 'writer') router.replace('/writer/dashboard');
      else router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message?: unknown }).message)
            : 'Login failed';
      setError(message);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        const detail = await sessionRes.json().catch(() => ({}));
        throw new Error(detail?.error ?? 'Unable to start session.');
      }
      const sessionData = await sessionRes.json().catch(() => ({}));
      const profile = sessionData?.profile ?? null;
      if (!profile) {
        const displayName = credential.user.displayName ?? credential.user.email ?? '';
        setProfileName(displayName);
        setProfileEmail(credential.user.email ?? '');
        setProfileToken(idToken);
        setNeedsProfile(true);
        return;
      }
      const role = profile?.role ?? null;
      if (role === 'student') router.replace('/student/dashboard');
      else if (role === 'writer') router.replace('/writer/dashboard');
      else router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
      console.error('Google login error:', err);
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
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Sign in to manage assignments and payments.</p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full rounded-full border border-emerald-200 bg-white px-4 py-2.5 font-semibold text-emerald-700 shadow-sm hover:border-emerald-300 disabled:opacity-60"
            >
              {loading ? 'Signing you in...' : 'Continue with Google'}
            </button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Or sign in with email
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4" aria-busy={loading}>
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
                autoComplete="current-password"
                disabled={loading}
                required
                placeholder="Enter your password"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-200 disabled:opacity-60">
              {loading ? 'Signing you in...' : 'Login'}
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
      {needsProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[color:var(--border)] bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Complete your profile</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Choose a role to finish setting up your account.</p>
            </div>
            <label className="block">
              <span className="text-sm">Role</span>
              <select
                value={profileRole}
                onChange={(e) => setProfileRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                disabled={creatingProfile}
              >
                <option value="student">Student</option>
                <option value="writer">Writer</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-sm">Display name</span>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                disabled={creatingProfile}
                placeholder="Your name"
              />
            </label>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                className="btn-secondary w-full"
                onClick={() => {
                  setNeedsProfile(false);
                  setProfileToken('');
                }}
                disabled={creatingProfile}
              >
                Cancel
              </button>
              <button
                className="btn-primary w-full disabled:opacity-60"
                disabled={creatingProfile}
                onClick={async () => {
                  if (!profileToken) return;
                  if (!profileName.trim()) {
                    setError('Please enter a display name.');
                    return;
                  }
                  setCreatingProfile(true);
                  setError(null);
                  try {
                    const registerRes = await fetch('/api/auth/register', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        idToken: profileToken,
                        role: profileRole,
                        displayName: profileName.trim(),
                        email: profileEmail,
                      }),
                    });
                    if (!registerRes.ok) {
                      const detail = await registerRes.json().catch(() => ({}));
                      throw new Error(detail?.error ?? 'Failed to create profile.');
                    }
                    const profileRes = await fetch('/api/auth/profile');
                    const profile = await profileRes.json().catch(() => ({}));
                    const role = profile?.profile?.role ?? profileRole;
                    if (role === 'student') router.replace('/student/dashboard');
                    else if (role === 'writer') router.replace('/writer/dashboard');
                    else router.replace('/admin/dashboard');
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Failed to create profile.';
                    setError(message);
                  } finally {
                    setCreatingProfile(false);
                  }
                }}
              >
                {creatingProfile ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
