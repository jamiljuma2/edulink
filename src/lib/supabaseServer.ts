import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type CookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
};

type CookieStoreLike = {
  get?: (name: string) => { value?: string } | undefined;
  getAll?: () => Array<{ name: string; value: string }>;
  set?: (cookie: { name: string; value: string } & CookieOptions) => void;
};

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const getCookie = (name: string) => {
    const store = cookieStore as CookieStoreLike;
    if (typeof store.get === 'function') return store.get(name)?.value;
    const all = typeof store.getAll === 'function' ? store.getAll() : [];
    const found = all.find((c: { name: string; value: string }) => c.name === name);
    return found?.value;
  };
  const setCookie = (name: string, value: string, options: CookieOptions) => {
    const store = cookieStore as CookieStoreLike;
    if (typeof store.set === 'function') store.set({ name, value, ...options });
  };
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookie(name);
        },
        set(name: string, value: string, options: CookieOptions) {
          setCookie(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          setCookie(name, '', options);
        },
      },
    }
  );
}
