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
  last_seen_at: string | null;
  is_online: boolean;
};

type AdminProfile = {
  role: string;
  approval_status: string;
};

async function requireAdmin(userId: string) {
  const { rows: profileRows } = await query<AdminProfile>(
    'select role, approval_status from profiles where id = $1',
    [userId]
  );
  const profile = profileRows[0];
  if (!profile) return { error: NextResponse.json({ error: 'Profile missing' }, { status: 403 }) };
  if (profile.approval_status !== 'approved') return { error: NextResponse.json({ error: 'Approval required' }, { status: 403 }) };
  if (profile.role !== 'admin') return { error: NextResponse.json({ error: 'Admin role required' }, { status: 403 }) };
  return { profile };
}

export async function GET(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await requireAdmin(user.id);
  if (admin.error) return admin.error;

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '50');
  const offsetParam = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

  const { rows } = await query<UserRow>(
    `select id, email, display_name, role, approval_status, created_at, last_seen_at,
            case when last_seen_at is not null and last_seen_at >= now() - interval '5 minutes' then true else false end as is_online
     from profiles
     order by created_at desc
     limit $1 offset $2`,
    [limit, offset]
  );

  return NextResponse.json({ users: rows ?? [] });
}

export async function PATCH(req: Request) {
  const user = await getServerFirebaseUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await requireAdmin(user.id);
  if (admin.error) return admin.error;

  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? '').trim();
  const action = String(body?.action ?? '').trim();
  const nextRole = body?.role ? String(body.role).trim() : null;

  if (!userId || !action) {
    return NextResponse.json({ error: 'userId and action are required.' }, { status: 400 });
  }

  if (userId === user.id && action !== 'set_role') {
    return NextResponse.json({ error: 'You cannot change your own account status.' }, { status: 400 });
  }

  if (action === 'approve') {
    await query('update profiles set approval_status = $1 where id = $2', ['approved', userId]);
  } else if (action === 'disable') {
    await query('update profiles set approval_status = $1 where id = $2', ['rejected', userId]);
  } else if (action === 'set_pending') {
    await query('update profiles set approval_status = $1 where id = $2', ['pending', userId]);
  } else if (action === 'set_role') {
    if (!nextRole || !['student', 'writer', 'admin'].includes(nextRole)) {
      return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });
    }

    if (userId === user.id && nextRole !== 'admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin role.' }, { status: 400 });
    }

    await query('update profiles set role = $1 where id = $2', [nextRole, userId]);
  } else {
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  }

  const { rows } = await query<UserRow>(
    `select id, email, display_name, role, approval_status, created_at, last_seen_at,
            case when last_seen_at is not null and last_seen_at >= now() - interval '5 minutes' then true else false end as is_online
     from profiles
     where id = $1`,
    [userId]
  );

  const updatedUser = rows[0];
  if (!updatedUser) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json({
    message: 'User updated successfully.',
    user: updatedUser,
  });
}