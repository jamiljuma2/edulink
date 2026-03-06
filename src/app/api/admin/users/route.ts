import { NextResponse } from 'next/server';
import { getServerFirebaseUser } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

type UserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  approval_status: string;
  created_at: string;
};

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

  const { rows } = await query<UserRow>(
    `select id, email, display_name, role, approval_status, created_at
     from profiles
     order by created_at desc
     limit $1 offset $2`,
    [limit, offset]
  );

  return NextResponse.json({ users: rows ?? [] });
}