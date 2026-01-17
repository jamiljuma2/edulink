import Link from 'next/link';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-[color:var(--border)] bg-white/90 p-8 shadow-xl backdrop-blur">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-emerald-600">EduLink Writers</p>
            <h1 className="text-2xl font-semibold">Admin Login</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Use the main login page to access admin tools.</p>
          </div>
          <Link href="/login" className="btn-primary w-full">Go to Login</Link>
        </div>
      </div>
    </div>
  );
}
