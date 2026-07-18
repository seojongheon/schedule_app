import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInquiryRepository, type InquiryRepositoryClient } from '@/data/repositories/inquiry-repository';
import { canCreateInquiry, INQUIRY_CATEGORIES } from '@/domain/support/inquiry-policy';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInquiryActor } from './_access';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

const createSchema = z.object({
  category: z.enum(INQUIRY_CATEGORIES),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10_000),
});

function repository() {
  const config = loadSecurityConfig();
  if (!config.encryption.keys[config.encryption.currentVersion]) throw new Error('Private-data protection is unavailable.');
  return createInquiryRepository(createSupabaseAdminClient() as unknown as InquiryRepositoryClient, config.encryption);
}

function errorResponse(requestId: string, status: number, message: string) {
  return NextResponse.json({ error: { code: status === 401 ? 'authentication_required' : 'inquiry_unavailable', message, requestId } }, { status });
}

async function getHandler(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const actor = await requireInquiryActor();
    const inquiries = await repository().listForUser(actor.userId);
    return NextResponse.json({ inquiries, requestId });
  } catch (error) {
    return errorResponse(requestId, error instanceof Error && error.message === 'Authentication required.' ? 401 : 403, '문의 목록을 불러올 수 없습니다.');
  }
}

async function postHandler(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const actor = await requireInquiryActor();
    const input = createSchema.parse(await request.json());
    if (!canCreateInquiry(actor.accountState, input.category)) {
      return errorResponse(requestId, 403, '현재 계정 상태에서는 이 문의 유형을 사용할 수 없습니다.');
    }
    const result = await repository().create({ actorUserId: actor.userId, ...input, requestId });
    return NextResponse.json({ ...result, requestId }, { status: 201 });
  } catch (error) {
    return errorResponse(requestId, error instanceof Error && error.message === 'Authentication required.' ? 401 : 400, '문의를 등록할 수 없습니다.');
  }
}

export const GET = withGeneralRateLimit(getHandler);
export const POST = withGeneralRateLimit(postHandler);
