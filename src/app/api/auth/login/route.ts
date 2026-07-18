import { NextResponse } from 'next/server';
import { loginInputSchema } from '@/domain/auth/auth-input';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const GENERIC_FAILURE = '이메일 또는 비밀번호를 확인해주세요.';

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const input = loginInputSchema.parse(await request.json());
    await enforceSensitiveLimit({ request, requestId, accountIdentifier: input.email });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
    if (error || !data.user) {
      return NextResponse.json({ message: GENERIC_FAILURE, requestId }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_state')
      .eq('id', data.user.id)
      .single();
    const securityProfile = profile as { account_state: string } | null;
    const accountState = securityProfile?.account_state ?? 'pending_profile';
    if (['suspended', 'deletion_pending', 'deleted'].includes(accountState)) {
      await supabase.auth.signOut({ scope: 'global' });
      return NextResponse.json({ message: GENERIC_FAILURE, requestId }, { status: 401 });
    }
    const now = new Date().toISOString();
    const profiles = supabase.from('profiles') as unknown as {
      update(values: Record<string, unknown>): { eq(column: string, value: string): Promise<unknown> };
    };
    await profiles.update({ session_started_at: now, last_seen_at: now, last_reauthenticated_at: now }).eq('id', data.user.id);
    const admin = createSupabaseAdminClient();
    const { error: auditError } = await admin.rpc('append_audit_event', {
      p_event_type: 'account.login', p_actor_type: 'user', p_actor_key: data.user.id,
      p_target_type: 'account', p_target_key: data.user.id, p_result: 'success',
      p_reason_code: 'login_succeeded', p_request_id: requestId, p_metadata: { operation: 'login' },
    });
    if (auditError) { await supabase.auth.signOut({ scope: 'global' }); throw auditError; }
    return NextResponse.json({
      next: accountState === 'active' ? '/dashboard' : '/auth/complete-profile',
      accountState,
      requestId,
    });
  } catch (error) {
    const retryAfter = error instanceof Error && 'retryAfter' in error
      ? Number((error as Error & { retryAfter: number }).retryAfter)
      : null;
    if (retryAfter) {
      return NextResponse.json({ message: '요청이 너무 많습니다.', requestId }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      });
    }
    return NextResponse.json({ message: GENERIC_FAILURE, requestId }, { status: 400 });
  }
}
