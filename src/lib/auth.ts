import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabaseServer';
import type { UserRole } from '@/lib/roles';

export async function getServerUserAndProfile() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null } as const;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, approval_status')
    .eq('id', user.id)
    .single();
  return { user, profile } as const;
}

export async function requireRole(role: UserRole) {
  const { user, profile } = await getServerUserAndProfile();
  if (!user || !profile) redirect('/login');
  if (profile.approval_status !== 'approved') redirect('/pending');
  if (profile.role !== role) redirect(`/${profile.role}/dashboard`);
  return { user, profile } as const;
}
