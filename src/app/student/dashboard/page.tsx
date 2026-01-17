import StudentDashboardClient from '@/components/dashboards/StudentDashboardClient';
import { requireRole } from '@/lib/auth';

export default async function StudentDashboard() {
  await requireRole('student');
  return <StudentDashboardClient />;
}
