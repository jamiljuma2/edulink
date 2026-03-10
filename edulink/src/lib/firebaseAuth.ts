import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { query } from '@/lib/db';

export const FIREBASE_SESSION_COOKIE = 'edulink_session';

export type FirebaseSessionUser = {
  id: string;
  email: string | null;
};

async function resolveProfileId(uid: string, email: string | null | undefined): Promise<string> {
  try {
    const { rows: idRows } = await query<{ id: string }>('select id from profiles where id = $1 limit 1', [uid]);
    if (idRows[0]?.id) return idRows[0].id;

    if (email) {
      const { rows: emailRows } = await query<{ id: string; count: string }>(
        `select id,
                count(*) over()::text as count
         from profiles
         where lower(email) = lower($1)
         order by created_at desc
         limit 2`,
        [email]
      );
      const matches = Number(emailRows[0]?.count ?? 0);
      if (matches === 1 && emailRows[0]?.id) {
        // Keep auth resilient when Firebase project/env rotates and UIDs differ across environments.
        return emailRows[0].id;
      }
    }
  } catch {
    // Auth should not fail hard due to profile resolution hiccups.
  }

  return uid;
}

async function touchLastSeen(userId: string) {
  try {
    await query(
      `update profiles
       set last_seen_at = now()
       where id = $1
         and (last_seen_at is null or last_seen_at < now() - interval '1 minute')`,
      [userId]
    );
  } catch {
    // Presence should not block auth flow.
  }
}

export async function getServerFirebaseUser(): Promise<FirebaseSessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const resolvedId = await resolveProfileId(decoded.uid, decoded.email ?? null);
    await touchLastSeen(resolvedId);
    return { id: resolvedId, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function getFirebaseUserFromRequest(request: NextRequest): Promise<FirebaseSessionUser | null> {
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const resolvedId = await resolveProfileId(decoded.uid, decoded.email ?? null);
    await touchLastSeen(resolvedId);
    return { id: resolvedId, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
