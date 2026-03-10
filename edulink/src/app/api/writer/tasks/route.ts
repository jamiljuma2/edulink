import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'writer') return NextResponse.json({ error: 'Writer role required' }, { status: 403 });

  const { rows } = await query(
    `select t.*, jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'description', a.description,
        'due_date', a.due_date,
        'storage_path', a.storage_path
      ) as assignments
     from tasks t
     left join assignments a on a.id = t.assignment_id
     where t.writer_id = $1
     order by t.created_at desc`,
    [user.id]
  );

  return NextResponse.json({ tasks: rows ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
