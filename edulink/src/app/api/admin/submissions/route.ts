import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Admin role required' }, { status: 403 });

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '50');
  const offsetParam = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;
  const to = offset + limit - 1;

  const { rows } = await query(
    `select ts.id, ts.status, ts.notes, ts.created_at, ts.storage_path, ts.task_id, ts.writer_id,
            jsonb_build_object(
              'id', t.id,
              'status', t.status,
              'assignments', jsonb_build_object(
                'id', a.id,
                'title', a.title,
                'student_id', a.student_id,
                'writer_id', a.writer_id
              )
            ) as tasks
     from task_submissions ts
     left join tasks t on t.id = ts.task_id
     left join assignments a on a.id = t.assignment_id
     order by ts.created_at desc
     limit $1 offset $2`,
    [limit, offset]
  );

  // Do not generate signed URLs here; just return the data with storage_path
  return NextResponse.json({ submissions: rows ?? [] });
}
