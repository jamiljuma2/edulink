import { NextResponse, type NextRequest } from 'next/server';
import { getFirebaseUserFromRequest } from '@/lib/firebaseAuth';
import { query } from '@/lib/db';

const PROTECTED_PREFIXES = ['/student', '/writer', '/admin'];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

type RateEntry = { count: number; resetAt: number };
const rateMap = new Map<string, RateEntry>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  const cfConnecting = request.headers.get('cf-connecting-ip');
  if (cfConnecting) return cfConnecting;
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

function pruneExpired(now: number) {
  for (const [key, entry] of rateMap.entries()) {
    if (entry.resetAt <= now) rateMap.delete(key);
  }
}

export async function proxy(request: NextRequest) {
  const now = Date.now();
  if (rateMap.size > 10_000) pruneExpired(now);

  const ip = getClientIp(request);
  const entry = rateMap.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
    rateMap.set(ip, entry);
    if (entry.count > RATE_LIMIT_MAX_REQUESTS && request.nextUrl.pathname.startsWith('/api/')) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(entry.resetAt),
          },
        }
      );
    }
  }
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const response = NextResponse.next();
  const user = await getFirebaseUserFromRequest(request);
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const { rows } = await query<{ role: string; approval_status: string }>(
    'select role, approval_status from profiles where id = $1',
    [user.id]
  );
  const profile = rows[0];

  if (!profile) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (profile.approval_status !== 'approved') {
    // Approval check removed
  }

  if (pathname.startsWith('/student') && profile.role !== 'student') {
    const url = request.nextUrl.clone();
    url.pathname = `/${profile.role}/dashboard`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/writer') && profile.role !== 'writer') {
    const url = request.nextUrl.clone();
    url.pathname = `/${profile.role}/dashboard`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && profile.role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = `/${profile.role}/dashboard`;
    return NextResponse.redirect(url);
  }

  const current = rateMap.get(ip);
  if (current && request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX_REQUESTS - current.count)));
    response.headers.set('X-RateLimit-Reset', String(current.resetAt));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};