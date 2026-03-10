import { Suspense } from 'react';
import PayPalReturnClient from '@/components/payments/PayPalReturnClient';

export default function PayPalReturnPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" /> }>
      <PayPalReturnClient />
    </Suspense>
  );
}
