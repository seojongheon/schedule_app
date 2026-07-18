import { NextResponse } from 'next/server';

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!['google', 'kakao', 'naver'].includes(provider)) return NextResponse.json({ message: '지원하지 않는 로그인 제공자입니다.' }, { status: 400 });
  return NextResponse.redirect(new URL(`/api/auth/provider/${provider}/start?mode=link`, request.url), 303);
}
