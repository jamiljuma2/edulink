import WriterDashboardClient from '@/components/dashboards/WriterDashboardClient';
import { requireRole } from '@/lib/auth';

export default async function WriterDashboard() {
  await requireRole('writer');
  return <WriterDashboardClient />;
}
