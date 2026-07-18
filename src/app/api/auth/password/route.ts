import { NextResponse } from 'next/server';
import { passwordChangeInputSchema } from '@/domain/auth/auth-input';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const input = passwordChangeInputSchema.parse(await request.json());
    await enforceSensitiveLimit({ request, requestId });
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: '인증이 필요합니다.', requestId }, { status: 401 });
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'global' });
    return NextResponse.json({ next: '/login', requestId });
  } catch (error) {
    if (error instanceof Error && 'retryAfter' in error) {
      const retryAfter = Number((error as Error & { retryAfter: number }).retryAfter);
      return NextResponse.json({ message: '요청이 너무 많습니다.', requestId }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
    }
    return NextResponse.json({ message: '비밀번호를 변경할 수 없습니다.', requestId }, { status: 400 });
  }
}
