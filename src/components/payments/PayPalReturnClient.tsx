"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';

export default function PayPalReturnClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Finalizing payment...');

  useEffect(() => {
    const orderId = params.get('token');
    if (!orderId) {
      setStatus('error');
      setMessage('Missing PayPal order reference.');
      return;
    }
    (async () => {
      try {
        await axios.post('/api/payments/paypal/capture', { orderId });
        setStatus('success');
        setMessage('Payment completed. Your wallet has been updated.');
        setTimeout(() => router.replace('/student/dashboard'), 800);
      } catch (err: unknown) {
        setStatus('error');
        setMessage('Payment capture failed. Please contact support.');
      }
    })();
  }, [params, router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">PayPal</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {status === 'loading' ? 'Processing' : status === 'success' ? 'Payment Successful' : 'Payment Failed'}
        </h1>
        <p className="mt-4 text-sm text-slate-300/80">{message}</p>
      </section>
    </main>
  );
}
