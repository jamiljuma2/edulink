import { redirect } from 'next/navigation';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';
import type { UserRole } from '@/lib/roles';

export type ProfileRow = {
  id: string;
  role: UserRole;
  approval_status: string;
};

export async function getProfileById(userId: string): Promise<ProfileRow | null> {
  const { rows } = await query<ProfileRow>(
    'select id, role, approval_status from profiles where id = $1',
    [userId]
  );
  return rows[0] ?? null;
}

export async function getServerUserAndProfile() {
  const user = await getServerFirebaseUser();
  if (!user) return { user: null, profile: null } as const;
  const profile = await getProfileById(user.id);
  return { user, profile } as const;
}

export async function requireRole(role: UserRole) {
  const { user, profile } = await getServerUserAndProfile();
  if (!user || !profile) redirect('/login');
  // Approval check removed
  if (profile.role !== role) redirect(`/${profile.role}/dashboard`);
  return { user, profile } as const;
}
