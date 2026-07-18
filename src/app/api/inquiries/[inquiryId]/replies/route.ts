import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInquiryRepository, type InquiryRepositoryClient } from '@/data/repositories/inquiry-repository';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInquiryActor } from '../../_access';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

const replySchema = z.object({ body: z.string().trim().min(1).max(10_000) });

function repository() {
  const config = loadSecurityConfig();
  if (!config.encryption.keys[config.encryption.currentVersion]) throw new Error('Private-data protection is unavailable.');
  return createInquiryRepository(createSupabaseAdminClient() as unknown as InquiryRepositoryClient, config.encryption);
}

async function postHandler(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const [{ inquiryId }, actor, input] = await Promise.all([context.params, requireInquiryActor(), request.json().then((body) => replySchema.parse(body))]);
    const result = await repository().reply({ inquiryId, actorUserId: actor.userId, serviceRoles: actor.serviceRoles, body: input.body, requestId });
    return NextResponse.json({ ...result, requestId }, { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Authentication required.' ? 401 : 403;
    return NextResponse.json({ error: { code: status === 401 ? 'authentication_required' : 'inquiry_reply_denied', message: '답변을 등록할 수 없습니다.', requestId } }, { status });
  }
}

export const POST = withGeneralRateLimit(postHandler);
