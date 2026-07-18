import { NextResponse } from 'next/server';
import { createGuardianVerificationAdapter } from '@/lib/auth/guardian-verification';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withSensitiveRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function postHandler(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const body = await request.json() as { action?: string; evidenceReference?: string };
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: '인증이 필요합니다.', requestId }, { status: 401 });
    const config = loadSecurityConfig();
    const environment = process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'test' ? 'test' : 'development';
    const adapter = createGuardianVerificationAdapter({ mode: config.guardianVerificationMode, environment });
    const result = body.action === 'verify'
      ? await adapter.verify({ evidenceReference: body.evidenceReference ?? '' })
      : await adapter.start({ childUserId: user.id });
    if (result.status === 'unavailable') return NextResponse.json({ message: '보호자 인증을 현재 사용할 수 없습니다.', requestId }, { status: 503 });
    if (result.status === 'pending') return NextResponse.json({ ...result, requestId }, { status: 202 });

    const guardianRpc = supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: Error | null }>;
    const { data, error } = await guardianRpc('record_guardian_verification', {
      p_status: result.status,
      p_provider: config.guardianVerificationMode,
      p_evidence_reference: body.evidenceReference ?? '',
      p_terms_version: '2026-07', p_privacy_version: '2026-07', p_request_id: requestId,
    });
    if (error) throw error;
    return NextResponse.json({ accountState: data, next: data === 'active' ? '/dashboard' : '/auth/complete-profile', requestId });
  } catch {
    return NextResponse.json({ message: '보호자 인증을 처리할 수 없습니다.', requestId }, { status: 400 });
  }
}

export const POST = withSensitiveRateLimit(postHandler);
