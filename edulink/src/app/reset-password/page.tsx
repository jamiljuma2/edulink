import { Suspense } from 'react';
import ResetPasswordClient from '@/components/auth/ResetPasswordClient';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
