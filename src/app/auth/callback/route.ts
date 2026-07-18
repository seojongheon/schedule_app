import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

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
  if (!error) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: sessionError } = await createSupabaseAdminClient().rpc('record_verified_authentication', {
        p_actor_user_id: user.id,
        p_request_id: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      });
      if (sessionError) return NextResponse.redirect(new URL('/login?callback=failed', request.url));
    }
  }
  const destination = error ? '/login?callback=failed' : mode === 'link' ? '/mypage?identity=linked' : '/auth/complete-profile';
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set('auth_flow_mode', '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
