import Link from "next/link";
import EduLinkLogo from "@/components/branding/EduLinkLogo";

export default function Home() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="border-b border-[color:var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <EduLinkLogo />
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary">Login</Link>
            <Link href="/register" className="btn-primary">Register</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6">
        <section className="grid items-center gap-10 py-16 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 shadow-sm">
              Trusted • Global • Secure
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
              EduLink Writers – Where Students Meet Trusted Academic Writers
            </h1>
            <p className="mt-4 text-lg text-[color:var(--muted)]">
              A professional platform connecting students and vetted writers worldwide with secure payments, fast delivery, and quality assurance.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register?role=student" className="btn-primary">Join as Student</Link>
              <Link href="/register?role=writer" className="btn-secondary">Join as Writer</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-[color:var(--muted)]">
              <span className="badge-success">Secure Payments</span>
              <span className="badge-success">Verified Writers</span>
              <span className="badge-success">Fast Delivery</span>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="card">
              <h3 className="text-lg font-semibold">Students</h3>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Upload assignments, fund your wallet, and get matched with expert writers.</p>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold">Writers</h3>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Subscribe to a plan, accept tasks, and submit completed work for review.</p>
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold">Admins</h3>
              <p className="mt-2 text-sm text-[color:var(--muted)]">Approve users, oversee payments, and ensure quality control.</p>
            </div>
          </div>
        </section>

        <section className="pb-12">
          <div className="card">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-[#1d4ed8]">Why EduLink?</h2>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 shadow-sm">
                <span className="text-3xl">🎓</span>
                <div>
                  <p className="font-semibold">Academic Integrity</p>
                  <p className="text-sm text-[color:var(--muted)]">Original, policy-aligned work with strict quality checks.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 shadow-sm">
                <span className="text-3xl">💳</span>
                <div>
                  <p className="font-semibold">Secure Payments</p>
                  <p className="text-sm text-[color:var(--muted)]">Protected transactions with wallet-based flow.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 shadow-sm">
                <span className="text-3xl">🛡️</span>
                <div>
                  <p className="font-semibold">Verified Writers</p>
                  <p className="text-sm text-[color:var(--muted)]">Subscription tiers and approvals ensure reliability.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 shadow-sm">
                <span className="text-3xl">🧑‍💼</span>
                <div>
                  <p className="font-semibold">Admin Oversight</p>
                  <p className="text-sm text-[color:var(--muted)]">Transparent reviews, approvals, and dispute handling.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-white/80 p-4 shadow-sm">
                <span className="text-3xl">🔒</span>
                <div>
                  <p className="font-semibold">Confidential & Reliable</p>
                  <p className="text-sm text-[color:var(--muted)]">Your data and files stay private and secure.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-16">
          <div className="card">
            <h3 className="text-xl font-semibold">Testimonials</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[color:var(--border)] p-4">
                <p className="text-sm text-[color:var(--muted)]">“Fast turnaround and clear communication. Highly recommend.”</p>
                <p className="mt-2 text-sm font-semibold">— Student, Kenya</p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] p-4">
                <p className="text-sm text-[color:var(--muted)]">“Great platform for writers to find consistent, fair work.”</p>
                <p className="mt-2 text-sm font-semibold">— Writer, UK</p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] p-4">
                <p className="text-sm text-[color:var(--muted)]">“Admin controls make quality assurance easy.”</p>
                <p className="mt-2 text-sm font-semibold">— Admin</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--border)] bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-[color:var(--muted)]">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row">
            <div>
              <p className="font-semibold text-[color:var(--foreground)]">EduLink Writers</p>
              <p>edulinkwriters@gmail.com</p>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link href="/login" className="hover:text-[color:var(--primary)]">Login</Link>
              <Link href="/register?role=student" className="hover:text-[color:var(--primary)]">Join as Student</Link>
              <Link href="/register?role=writer" className="hover:text-[color:var(--primary)]">Join as Writer</Link>
              <Link href="/about" className="hover:text-[color:var(--primary)]">About</Link>
              <Link href="/contact" className="hover:text-[color:var(--primary)]">Contact</Link>
              <Link href="/privacy" className="hover:text-[color:var(--primary)]">Privacy</Link>
            </div>
          </div>
          <div className="mt-6 text-xs uppercase tracking-widest text-[color:var(--muted)]/80">
            © 2026 EduLink Writers. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
