import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const mode = url.searchParams.get('mode');
  const provider = url.searchParams.get('provider');
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)auth_flow_mode=([^;]+)/)?.[1];
  const expected = `${mode}:${provider}`;
  if (!code || !cookie || decodeURIComponent(cookie) !== expected || !['signin', 'link'].includes(mode ?? '') || !['google', 'kakao', 'naver'].includes(provider ?? '')) {
    return NextResponse.redirect(new URL('/login?callback=invalid', request.url));
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const destination = error ? '/login?callback=failed' : mode === 'link' ? '/mypage?identity=linked' : '/auth/complete-profile';
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set('auth_flow_mode', '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
