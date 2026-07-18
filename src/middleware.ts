import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/data/database.types';
import { evaluateMiddlewareAccess } from '@/lib/auth/middleware-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function withSessionCookies(source: NextResponse, target: NextResponse) {
  const setCookie = source.headers.get('set-cookie');
  if (setCookie) target.headers.set('set-cookie', setCookie);
  return target;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_PUBLIC_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const initialDecision = evaluateMiddlewareAccess({
    pathname: request.nextUrl.pathname,
    method: request.method,
    authenticated: false,
    profile: null,
  });
  const protectedPath = initialDecision.action !== 'allow';
  if (!supabaseUrl || !supabaseKey) {
    if (protectedPath) return NextResponse.redirect(new URL('/login', request.url));
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!protectedPath) return response;
  if (!user) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return withSessionCookies(response, NextResponse.json({ error: { code: 'authentication_required', message: '인증이 필요합니다.' } }, { status: 401 }));
    }
    return withSessionCookies(response, NextResponse.redirect(new URL('/login', request.url)));
  }

  const { data } = await supabase.from('profiles')
    .select('account_state, session_started_at, last_seen_at')
    .eq('id', user.id)
    .single();
  const profile = data as unknown as {
    account_state: string;
    session_started_at: string | null;
    last_seen_at: string | null;
  } | null;
  const decision = evaluateMiddlewareAccess({
    pathname: request.nextUrl.pathname,
    method: request.method,
    authenticated: true,
    profile: profile ? {
      accountState: profile.account_state,
      sessionStartedAt: profile.session_started_at,
      lastSeenAt: profile.last_seen_at,
    } : null,
  });
  if (decision.action === 'expire_session') {
    await supabase.auth.signOut({ scope: 'global' });
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return withSessionCookies(response, NextResponse.json({ error: { code: 'session_expired', message: '세션이 만료되었습니다.' } }, { status: 401 }));
    }
    return withSessionCookies(response, NextResponse.redirect(new URL('/login?session=expired', request.url)));
  }
  if (decision.action === 'redirect') return withSessionCookies(response, NextResponse.redirect(new URL(decision.location, request.url)));
  if (decision.action === 'authentication_required') {
    return withSessionCookies(response, NextResponse.json({ error: { code: 'authentication_required', message: '인증이 필요합니다.' } }, { status: 401 }));
  }
  if (profile?.last_seen_at && Date.now() - new Date(profile.last_seen_at).getTime() >= 5 * 60 * 1000) {
    await createSupabaseAdminClient().rpc('touch_session_activity', { p_actor_user_id: user.id });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
