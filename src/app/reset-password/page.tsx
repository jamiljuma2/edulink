"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebaseClient';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const auth = useMemo(() => getFirebaseAuth(), []);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const oobCode = params.get('oobCode') ?? '';
    setCode(oobCode);
    if (!oobCode) {
      setError('Invalid or expired reset link.');
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setError(null);
      })
      .catch(() => {
        setError('Invalid or expired reset link.');
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [auth, params]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (verifying) return;
    if (!code) {
      setError('Invalid or expired reset link.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    try {
      await confirmPasswordReset(auth, code, password);
      setSuccess(true);
      setTimeout(() => {
        router.replace('/login');
      }, 600);
    } catch {
      setError('Reset failed. Request a new link.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-[color:var(--border)] bg-white/90 p-8 shadow-xl backdrop-blur">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-emerald-600">EduLink Writers</p>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {email ? `Resetting password for ${email}.` : 'Set a new password to continue.'}
            </p>
          </div>
          <form onSubmit={handleReset} className="space-y-4" aria-busy={verifying}>
            <label className="block">
              <span className="text-sm">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 form-input-clear"
                autoComplete="new-password"
                disabled={verifying || success}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm">Confirm password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 form-input-clear"
                autoComplete="new-password"
                disabled={verifying || success}
                required
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">Password reset. Redirecting to login...</p>}
            <button
              disabled={verifying || success}
              className="w-full rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {verifying ? 'Checking link...' : 'Reset password'}
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
