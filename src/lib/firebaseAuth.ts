import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { query } from '@/lib/db';

export const FIREBASE_SESSION_COOKIE = 'edulink_session';

export type FirebaseSessionUser = {
  id: string;
  email: string | null;
};

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
    await touchLastSeen(decoded.uid);
    return { id: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function getFirebaseUserFromRequest(request: NextRequest): Promise<FirebaseSessionUser | null> {
  const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    await touchLastSeen(decoded.uid);
    return { id: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
