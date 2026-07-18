import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInquiryRepository, type InquiryRepositoryClient } from '@/data/repositories/inquiry-repository';
import { INQUIRY_STATUSES } from '@/domain/support/inquiry-policy';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInquiryActor } from '../_access';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

const statusSchema = z.object({ status: z.enum(INQUIRY_STATUSES) });

function repository() {
  const config = loadSecurityConfig();
  if (!config.encryption.keys[config.encryption.currentVersion]) throw new Error('Private-data protection is unavailable.');
  return createInquiryRepository(createSupabaseAdminClient() as unknown as InquiryRepositoryClient, config.encryption);
}

function errorResponse(requestId: string, status: number, message: string) {
  return NextResponse.json({ error: { code: status === 401 ? 'authentication_required' : 'inquiry_access_denied', message, requestId } }, { status });
}

async function getHandler(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    const [{ inquiryId }, actor] = await Promise.all([context.params, requireInquiryActor()]);
    const inquiry = await repository().getDetail({ inquiryId, actorUserId: actor.userId, serviceRoles: actor.serviceRoles, requestId });
    return NextResponse.json({ inquiry, requestId });
  } catch (error) {
    return errorResponse(requestId, error instanceof Error && error.message === 'Authentication required.' ? 401 : 403, '문의 내용을 불러올 수 없습니다.');
  }
}

async function patchHandler(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const [{ inquiryId }, actor, input] = await Promise.all([context.params, requireInquiryActor(), request.json().then((body) => statusSchema.parse(body))]);
    const inquiry = await repository().changeStatus({ inquiryId, actorUserId: actor.userId, serviceRoles: actor.serviceRoles, status: input.status, requestId });
    return NextResponse.json({ inquiry, requestId });
  } catch (error) {
    return errorResponse(requestId, error instanceof Error && error.message === 'Authentication required.' ? 401 : 400, '문의 상태를 변경할 수 없습니다.');
  }
}

export const GET = withGeneralRateLimit(getHandler);
export const PATCH = withGeneralRateLimit(patchHandler);
