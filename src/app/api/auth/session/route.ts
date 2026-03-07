import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { query } from '@/lib/db';
import { FIREBASE_SESSION_COOKIE } from '@/lib/firebaseAuth';

const SESSION_EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000;

function formatSessionError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code ?? '') : '';
  const message = error instanceof Error ? error.message : '';

  if (code === 'auth/id-token-expired' || message.toLowerCase().includes('expired')) {
    return { status: 401, error: 'Your sign-in token expired. Please try logging in again.' };
  }

  if (message.includes('incorrect "aud"') || message.includes('Firebase ID token has incorrect')) {
    return {
      status: 401,
      error: 'Token project mismatch. Verify NEXT_PUBLIC_FIREBASE_PROJECT_ID matches FIREBASE_PROJECT_ID and service account project.',
    };
  }

  if (message.includes('certificate') || message.includes('public key')) {
    return { status: 503, error: 'Firebase token verification service unavailable. Try again shortly.' };
  }

  if (message.toLowerCase().includes('firebase admin config mismatch')) {
    return { status: 500, error: 'Server Firebase configuration mismatch. Check FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL.' };
  }

  if (code === 'auth/argument-error') {
    return { status: 401, error: 'Malformed or unsupported auth token. Please sign in again.' };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      status: 401,
      error: `Invalid token (${code || 'unknown'}). ${message || 'No additional details.'}`,
    };
  }

  return { status: 401, error: 'Invalid token.' };
}

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
    await query('update profiles set last_seen_at = now() where id = $1', [decoded.uid]);
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
    const formatted = formatSessionError(error);
    return NextResponse.json({ error: formatted.error }, { status: formatted.status });
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
