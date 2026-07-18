import { NextResponse } from 'next/server';
import { recoveryInputSchema } from '@/domain/auth/auth-input';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const accepted = { message: '계정이 확인되면 비밀번호 재설정 이메일을 보내드립니다.', requestId };
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const input = recoveryInputSchema.parse(await request.json());
    await enforceSensitiveLimit({ request, requestId, accountIdentifier: input.email });
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(input.email, { redirectTo: `${siteUrl}/auth/recovery-callback` });
    return NextResponse.json(accepted, { status: 202 });
  } catch (error) {
    if (error instanceof Error && 'retryAfter' in error) {
      const retryAfter = Number((error as Error & { retryAfter: number }).retryAfter);
      return NextResponse.json({ message: '요청이 너무 많습니다.', requestId }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
    }
    return NextResponse.json(accepted, { status: 202 });
  }
}
