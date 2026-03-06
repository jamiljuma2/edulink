import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { getClient, query } from '@/lib/db';
import type { UserRole } from '@/lib/roles';

const ALLOWED_ROLES: UserRole[] = ['student', 'writer'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const idToken = body?.idToken as string | undefined;
  const role = body?.role as UserRole | undefined;
  const displayName = body?.displayName as string | undefined;
  const email = body?.email as string | undefined;
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!idToken || !role || !displayName || !email) {
    return NextResponse.json({ error: 'Missing registration fields.' }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }
  try {
    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    // Check if email already belongs to a different user
    const { rows: existing } = await query<{ id: string }>(
      'select id from profiles where email = $1',
      [normalizedEmail]
    );
    if (existing.length > 0 && existing[0].id !== decoded.uid) {
      const existingId = existing[0].id;
      let hasAuthUser = true;
      try {
        await adminAuth.getUser(existingId);
      } catch (err: unknown) {
        const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
        hasAuthUser = code !== 'auth/user-not-found';
      }

      if (hasAuthUser) {
        return NextResponse.json({ error: 'An account with this email already exists. Try logging in instead.' }, { status: 409 });
      }

      // If the email is held by an orphan profile row with no Firebase auth user,
      // allow reclaim only when no related records exist to avoid data corruption.
      const { rows: refs } = await query<{ has_data: boolean }>(
        `select (
           exists(select 1 from wallets where user_id = $1)
           or exists(select 1 from transactions where user_id = $1)
           or exists(select 1 from assignments where student_id = $1 or writer_id = $1)
           or exists(select 1 from tasks where writer_id = $1)
           or exists(select 1 from task_submissions where writer_id = $1)
           or exists(select 1 from subscriptions where writer_id = $1)
           or exists(select 1 from registration_logs where user_id = $1)
         ) as has_data`,
        [existingId]
      );

      if (refs[0]?.has_data) {
        return NextResponse.json({ error: 'This email is linked to existing account data. Contact support to recover access.' }, { status: 409 });
      }

      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query('delete from profiles where id = $1', [existingId]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    await query(
      `insert into profiles (id, email, display_name, role, approval_status)
       values ($1, $2, $3, $4, 'approved')
       on conflict (id) do update set
         email = excluded.email,
         display_name = excluded.display_name,
         role = excluded.role,
         approval_status = excluded.approval_status`,
      [decoded.uid, normalizedEmail, displayName, role]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error) {
      console.error('Registration error message:', error.message);
    }
    const isTokenError = error instanceof Error && (
      error.message.includes('token') || error.message.includes('auth')
    );
    if (isTokenError) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
