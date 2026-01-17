import AdminDashboardClient from '@/components/dashboards/AdminDashboardClient';
import { requireRole } from '@/lib/auth';

export default async function AdminDashboard() {
  await requireRole('admin');
  return <AdminDashboardClient />;
}
