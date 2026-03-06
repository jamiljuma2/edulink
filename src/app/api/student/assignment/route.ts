import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  const { title, description, storage_path, due_date } = await req.json();
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rows: profileRows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = profileRows[0];
  if (!profile) return NextResponse.json({ error: 'Profile missing' }, { status: 403 });
  if (profile.approval_status !== 'approved') return NextResponse.json({ error: 'Approval required' }, { status: 403 });
  if (profile.role !== 'student') return NextResponse.json({ error: 'Student role required' }, { status: 403 });
  if (!title || !storage_path) return NextResponse.json({ error: 'Missing assignment details' }, { status: 400 });
  if (!due_date) return NextResponse.json({ error: 'Due date is required' }, { status: 400 });

  const { rows } = await query(
    `insert into assignments (student_id, title, description, status, storage_path, due_date)
     values ($1, $2, $3, 'open', $4, $5)
     returning *`,
    [user.id, title, description ?? null, storage_path, due_date]
  );
  const assignment = rows[0];
  if (!assignment) return NextResponse.json({ error: 'Failed to create assignment' }, { status: 400 });

  return NextResponse.json({ assignment });
}
