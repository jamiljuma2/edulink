"use client";
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';
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
  const authBusyRef = useRef(false);
  const router = useRouter();
  const auth = useMemo(() => getFirebaseAuth(), []);

  function startAuthFlow() {
    if (authBusyRef.current) return false;
    authBusyRef.current = true;
    setLoading(true);
    setError(null);
    return true;
  }

  function endAuthFlow() {
    authBusyRef.current = false;
    setLoading(false);
  }

  function formatAuthError(err: unknown, fallback: string) {
    const code = typeof err === 'object' && err && 'code' in err ? String((err as FirebaseError).code) : '';
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is disabled. Enable it in Firebase Auth.';
      case 'auth/user-not-found':
        return 'No account found with that email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/invalid-credential':
        return 'Invalid details.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection.';
      default: {
        const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : fallback;
        const message = String(raw ?? '').trim();
        return message || fallback;
      }
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!startAuthFlow()) return;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError('Enter a valid email address.');
        endAuthFlow();
        return;
      }
      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
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
      setError(formatAuthError(err, 'Login failed'));
      console.error('Login error:', err);
    } finally {
      endAuthFlow();
    }
  }

  async function handleGoogleLogin() {
    if (!startAuthFlow()) return;
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
      setError(formatAuthError(err, 'Google sign-in failed'));
      console.error('Google login error:', err);
    } finally {
      endAuthFlow();
    }
  }

  async function handlePasswordReset() {
    if (!startAuthFlow()) return;
    if (!email.trim()) {
      setError('Enter your email first to reset your password.');
      endAuthFlow();
      return;
    }
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError('Enter a valid email address.');
        endAuthFlow();
        return;
      }
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const actionUrl = `${baseUrl}/reset-password`;
      await sendPasswordResetEmail(auth, normalizedEmail, {
        url: actionUrl,
        handleCodeInApp: true,
      });
      setError('Password reset email sent. Check your inbox.');
    } catch (err: unknown) {
      setError(formatAuthError(err, 'Failed to send reset email.'));
    } finally {
      endAuthFlow();
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
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[#dadce0] bg-white px-4 py-2.5 font-semibold text-[#3c4043] shadow-sm hover:bg-[#f8f9fa] disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.72 1.22 9.21 3.61l6.9-6.9C36.07 2.48 30.42 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.07 6.27C12.35 13.24 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.5 24c0-1.64-.15-3.22-.43-4.75H24v9.01h12.7c-.55 2.97-2.22 5.49-4.75 7.18l7.28 5.64C43.02 36.86 46.5 30.93 46.5 24z" />
                  <path fill="#FBBC05" d="M10.63 28.49a14.5 14.5 0 0 1 0-8.98l-8.07-6.27A23.91 23.91 0 0 0 0 24c0 3.85.92 7.49 2.56 10.76l8.07-6.27z" />
                  <path fill="#34A853" d="M24 48c6.42 0 11.82-2.13 15.76-5.78l-7.28-5.64c-2.02 1.36-4.61 2.17-8.48 2.17-6.26 0-11.65-3.74-13.37-9.01l-8.07 6.27C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </span>
              <span>{loading ? 'Signing you in...' : 'Continue with Google'}</span>
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
            {error && (
              <p className={error.toLowerCase().includes('sent') ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
                {error}
              </p>
            )}
            <button disabled={loading} className="w-full rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-200 disabled:opacity-60">
              {loading ? 'Signing you in...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loading}
              className="w-full text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Forgot password?
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
