import { NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/request-security';
import { withSensitiveRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function postHandler(request: Request, context: { params: Promise<{ provider: string }> }) {
  assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
  const { provider } = await context.params;
  if (!['google', 'kakao', 'naver'].includes(provider)) return NextResponse.json({ message: '지원하지 않는 로그인 제공자입니다.' }, { status: 400 });
  return NextResponse.redirect(new URL(`/api/auth/provider/${provider}/start?mode=link`, request.url), 303);
}

export const POST = withSensitiveRateLimit(postHandler);
