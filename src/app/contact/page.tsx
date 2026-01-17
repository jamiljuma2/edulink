export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">Contact</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
          We’re here to help.
        </h1>
        <p className="mt-6 text-base text-slate-200/80 sm:text-lg">
          Reach out for support, partnership inquiries, or account assistance. We typically respond
          within 24 hours on business days.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Support email</h2>
            <p className="mt-3 text-sm text-slate-300/80">edulinkwriters@gmail.com</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Phone</h2>
            <p className="mt-3 text-sm text-slate-300/80">+254700686463</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Office hours</h2>
            <p className="mt-3 text-sm text-slate-300/80">Mon–Fri, 9:00 AM – 6:00 PM (EAT)</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Address</h2>
            <p className="mt-3 text-sm text-slate-300/80">Nairobi, Kenya</p>
          </div>
        </div>
      </section>
    </main>
  );
}
