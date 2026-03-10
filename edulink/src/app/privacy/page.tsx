export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">Privacy</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
          Privacy and data protection.
        </h1>
        <p className="mt-6 text-base text-slate-200/80 sm:text-lg">
          We collect only the information needed to deliver services, process payments, and keep the
          platform secure. Your data is never sold to third parties.
        </p>
        <div className="mt-10 space-y-6">
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">What we collect</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              Basic account details, assignment metadata, transaction records, and communication
              history required for support.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">How we use data</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              To authenticate users, match tasks, process payments, resolve disputes, and improve the
              platform experience.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Your controls</h2>
            <p className="mt-3 text-sm text-slate-300/80">
              You can request account deletion or data exports through support at any time.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
