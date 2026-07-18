import { NextResponse } from 'next/server';
import { registrationInputSchema } from '@/domain/auth/auth-input';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const accepted = { message: '가입 가능한 경우 확인 이메일을 보내드렸습니다.', requestId };
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const input = registrationInputSchema.parse(await request.json());
    await enforceSensitiveLimit({ request, requestId, accountIdentifier: input.email });
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: `${siteUrl}/auth/callback?mode=signin` },
    });
    return NextResponse.json(accepted, { status: 202 });
  } catch (error) {
    if (error instanceof Error && 'retryAfter' in error) {
      const retryAfter = Number((error as Error & { retryAfter: number }).retryAfter);
      return NextResponse.json({ message: '요청이 너무 많습니다.', requestId }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
    }
    return NextResponse.json(accepted, { status: 202 });
  }
}
