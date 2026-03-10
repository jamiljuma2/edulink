import { Suspense } from 'react';
import RegisterClient from '@/components/auth/RegisterClient';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50" />}>
      <RegisterClient />
    </Suspense>
  );
}
