import { NextResponse } from 'next/server';
import { passwordChangeInputSchema } from '@/domain/auth/auth-input';
import { hasRecentAuthentication, hasRecentRecoverySession } from '@/domain/auth/account-policy';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function sessionClaims(accessToken: string): { iat?: number; amr?: Array<{ method?: string }> } {
  try {
    return JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      iat?: number; amr?: Array<{ method?: string }>;
    };
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const input = passwordChangeInputSchema.parse(await request.json());
    await enforceSensitiveLimit({ request, requestId });
    const supabase = await createSupabaseServerClient();
    const [{ data: { user } }, { data: { session } }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    if (!user) return NextResponse.json({ message: '인증이 필요합니다.', requestId }, { status: 401 });
    const { data: profile } = await supabase.from('profiles')
      .select('last_reauthenticated_at').eq('id', user.id).single() as unknown as {
        data: { last_reauthenticated_at: string | null } | null;
      };
    const claims = session ? sessionClaims(session.access_token) : {};
    const recentlyAuthenticated = hasRecentAuthentication(profile?.last_reauthenticated_at)
      || hasRecentRecoverySession({
        recoverySentAt: user.recovery_sent_at,
        issuedAtSeconds: claims.iat,
        methods: claims.amr?.flatMap((entry) => entry.method ? [entry.method] : []) ?? [],
      });
    if (!recentlyAuthenticated) {
      return NextResponse.json({ message: '최근 인증이 필요합니다.', requestId }, { status: 403 });
    }
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw error;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) throw signOutError;
    return NextResponse.json({ next: '/login', requestId });
  } catch (error) {
    if (error instanceof Error && 'retryAfter' in error) {
      const retryAfter = Number((error as Error & { retryAfter: number }).retryAfter);
      return NextResponse.json({ message: '요청이 너무 많습니다.', requestId }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
    }
    return NextResponse.json({ message: '비밀번호를 변경할 수 없습니다.', requestId }, { status: 400 });
  }
}
