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
    `select id, email, display_name, role, approval_status, created_at
     from profiles
     where approval_status = 'pending'
     order by created_at asc
     limit $1 offset $2`,
    [limit, offset]
  );

  return NextResponse.json({ pending: rows ?? [] });
}

export async function POST(req: Request) {
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

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  await query('update profiles set approval_status = $1 where id = $2', ['approved', userId]);
  await query(
    'insert into wallets (user_id, balance, currency) values ($1, 0, $2) on conflict (user_id) do nothing',
    [userId, 'USD']
  );

  return NextResponse.json({ ok: true });
}
