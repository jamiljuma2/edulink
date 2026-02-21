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
      // Sign in and fetch profile in parallel
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      let prof = null;
      if (authData.user?.id) {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, role, approval_status')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profileErr) throw profileErr;
        prof = profileData;
      }
      // Removed duplicate declaration of 'let prof = profileData;'
      // If profile missing, create it
      if (!prof && authData.user) {
        const meta = authData.user.user_metadata ?? {};
        if (!meta.role) {
          throw new Error('Account not registered. Please register before logging in.');
        }
        if (authData.user.id && meta.role) {
          const { data: newProf, error: cErr } = await supabase.from('profiles').insert({
            id: authData.user.id,
            email: authData.user.email,
            display_name: meta.display_name ?? authData.user.email,
            role: meta.role,
            approval_status: 'approved',
          }).select('id, role, approval_status').single();
          if (cErr) {
            // If duplicate key error, fetch existing profile
            if (cErr.code === '23505' || (cErr.message && cErr.message.includes('duplicate key'))) {
              const { data: existingProf } = await supabase
                .from('profiles')
                .select('id, role, approval_status')
                .eq('id', authData.user.id)
                .maybeSingle();
              prof = existingProf;
            } else {
              throw cErr;
            }
          } else {
            prof = newProf;
          }
        }
      }
      if (!prof) throw new Error('Profile not found');
      // Cache profile data client-side
      if (prof) {
        try {
          localStorage.setItem('edulink_profile', JSON.stringify(prof));
        } catch {}
      }
      // Route by role
      if (prof.role === 'student') router.replace('/student/dashboard');
      else if (prof.role === 'writer') router.replace('/writer/dashboard');
      else router.replace('/admin/dashboard');
    } catch (err: any) {
          let message = 'Login failed';
          if (err && typeof err === 'object') {
            if ('message' in err && typeof err.message === 'string') {
              message = err.message;
            } else if (Object.keys(err).length > 0) {
              message = JSON.stringify(err);
            }
          } else if (typeof err === 'string') {
            message = err;
          }
          setError(message);
      console.error('Login error:', err);
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
    </div>
  );
}
