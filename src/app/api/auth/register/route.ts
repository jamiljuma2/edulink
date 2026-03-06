import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { query } from '@/lib/db';
import type { UserRole } from '@/lib/roles';

const ALLOWED_ROLES: UserRole[] = ['student', 'writer'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const idToken = body?.idToken as string | undefined;
  const role = body?.role as UserRole | undefined;
  const displayName = body?.displayName as string | undefined;
  const email = body?.email as string | undefined;
  if (!idToken || !role || !displayName || !email) {
    return NextResponse.json({ error: 'Missing registration fields.' }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }
  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
    await query(
      `insert into profiles (id, email, display_name, role, approval_status)
       values ($1, $2, $3, $4, 'approved')
       on conflict (id) do update set
         email = excluded.email,
         display_name = excluded.display_name,
         role = excluded.role,
         approval_status = excluded.approval_status`,
      [decoded.uid, email, displayName, role]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error) {
      console.error('Registration error message:', error.message);
    }
    return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
  }
}
