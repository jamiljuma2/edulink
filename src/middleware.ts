import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PREFIXES = ['/student', '/writer', '/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, approval_status')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (profile.approval_status !== 'approved') {
    const url = request.nextUrl.clone();
    url.pathname = '/pending';
    return NextResponse.redirect(url);
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
