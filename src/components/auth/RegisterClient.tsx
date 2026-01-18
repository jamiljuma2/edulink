"use client";

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';
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

  const supabase = useMemo(() => supabaseClient(), []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            role,
          },
        },
      });
      if (signErr) throw signErr;
      const user = data.user;
      if (!user) throw new Error('No user created');
      if (data.session) {
        const { error: profErr } = await supabase
          .from('profiles')
          .insert({ id: user.id, email, display_name: name, role, approval_status: 'pending' });
        if (profErr) throw profErr;
        setOk('Account created. Redirecting to login...');
      } else {
        setOk('Check your email to confirm your account. Then log in to complete setup.');
      }
      setTimeout(() => router.replace('/login'), 300);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
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
          <form onSubmit={handleRegister} className="space-y-4" aria-busy={loading}>
            <label className="block">
              <span className="text-sm">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
                className="mt-1 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                autoComplete="name"
                disabled={loading}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                autoComplete="email"
                disabled={loading}
                required
              />
            </label>
            <label className="block">
              <span className="text-sm">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                autoComplete="new-password"
                disabled={loading}
                required
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
    </div>
  );
}
