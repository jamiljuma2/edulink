import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();
  if (pErr || !profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from('task_submissions')
    .select('id, status, notes, created_at, storage_path, task_id, writer_id, tasks:task_id (id, status, assignments:assignment_id (id, title, student_id, writer_id))')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const submissions = await Promise.all(
    (data ?? []).map(async (s) => {
      const { data: signed } = await admin.storage.from('submissions').createSignedUrl(s.storage_path, 3600);
      return { ...s, signedUrl: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ submissions });
}
