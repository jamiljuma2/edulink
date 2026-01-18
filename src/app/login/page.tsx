"use client";
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => supabaseClient(), []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      // Fetch profile to route by role; create if missing
      type Profile = { id: string; role: string; approval_status: string };
      let prof: Profile | null = null;
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .maybeSingle();
      if (!existing) {
        const meta = data.user?.user_metadata ?? {};
        if (data.user?.id && meta.role) {
          const { data: created, error: cErr } = await supabase.from('profiles').insert({
            id: data.user.id,
            email: data.user.email,
            display_name: meta.display_name ?? data.user.email,
            role: meta.role,
            approval_status: 'pending',
          }).select('*').single();
          if (cErr) throw cErr;
          prof = created;
        } else {
          throw new Error('Profile missing and user metadata incomplete.');
        }
      } else {
        prof = existing;
      }
      if (!prof) throw new Error('Profile not found');
      if (prof.approval_status !== 'approved') {
        router.replace('/pending');
        return;
      }
      if (prof.role === 'student') router.replace('/student/dashboard');
      else if (prof.role === 'writer') router.replace('/writer/dashboard');
      else router.replace('/admin/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
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
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Sign in to manage assignments and payments.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4" aria-busy={loading}>
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
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={loading} className="w-full rounded-full bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-200 disabled:opacity-60">
              {loading ? 'Signing you in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
