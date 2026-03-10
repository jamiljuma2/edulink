export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">About EduLink Writers</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
          Built to connect learners with verified academic writers.
        </h1>
        <p className="mt-6 text-base text-slate-200/80 sm:text-lg">
          EduLink Writers is a secure collaboration platform where students post assignments and
          vetted writers deliver high-quality drafts on time. Our mission is to simplify academic
          support with transparency, safety, and global access.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Verified talent</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              Every writer is reviewed before approval, ensuring quality and professional conduct.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Protected payments</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              Payments are tracked through secure transactions with clear records for every task.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Privacy first</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              Your data is encrypted in transit with strict access controls and role-based security.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Global reach</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              Students and writers connect across regions with reliable workflows and support.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
