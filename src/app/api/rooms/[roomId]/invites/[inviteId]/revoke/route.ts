import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInviteRepository } from '@/data/repositories/invite-repository';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { computeInviteIpKey, getVerifiedInviteActor } from '@/app/api/invites/[token]/invite-handlers';

const requestSchema = z.object({ reason: z.string().trim().min(1).max(500) });
type RpcClient = Parameters<typeof createInviteRepository>[0];

async function revokeHandler(
  request: Request,
  context: { params: Promise<{ roomId: string; inviteId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const [{ roomId, inviteId }, input] = await Promise.all([context.params, request.json().then((body) => requestSchema.parse(body))]);
    const actorUserId = await getVerifiedInviteActor();
    await createInviteRepository(createSupabaseAdminClient() as unknown as RpcClient)
      .revoke(roomId, inviteId, input.reason, computeInviteIpKey(request), requestId, actorUserId);
    return NextResponse.json({ status: 'revoked', requestId });
  } catch {
    return NextResponse.json({ message: '초대 링크를 취소할 수 없습니다.', requestId }, { status: 400 });
  }
}

export const POST = withGeneralRateLimit(revokeHandler);
