import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';

export const FIREBASE_SESSION_COOKIE = 'edulink_session';

export type FirebaseSessionUser = {
  id: string;
  email: string | null;
};

export async function getServerFirebaseUser(): Promise<FirebaseSessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
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
    return { id: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
