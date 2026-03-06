import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { query } from '@/lib/db';
import { FIREBASE_SESSION_COOKIE } from '@/lib/firebaseAuth';

const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const idToken = body?.idToken as string | undefined;
  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken.' }, { status: 400 });
  }
  try {
    const adminAuth = getFirebaseAdminAuth();
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });
    const decoded = await adminAuth.verifyIdToken(idToken);
    const { rows } = await query(
      'select id, role, approval_status from profiles where id = $1',
      [decoded.uid]
    );
    const profile = rows[0] ?? null;
    const response = NextResponse.json({ ok: true, profile });
    response.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('Session cookie error:', error);
    if (error instanceof Error) {
      console.error('Session cookie error message:', error.message);
    }
    return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FIREBASE_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
