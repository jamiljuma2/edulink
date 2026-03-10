export default function PayPalCancelPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">PayPal</p>
        <h1 className="mt-3 text-3xl font-semibold">Payment Cancelled</h1>
        <p className="mt-4 text-sm text-slate-300/80">You cancelled the PayPal checkout. You can try again anytime.</p>
      </section>
    </main>
  );
}
