import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInviteRepository } from '@/data/repositories/invite-repository';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { computeInviteIpKey, getVerifiedInviteActor } from '@/app/api/invites/[token]/invite-handlers';

const createSchema = z.object({ grantRole: z.enum(['member', 'viewer']), expiresAt: z.string().datetime(), maxUses: z.number().int().min(1).max(1000) });
type RpcClient = Parameters<typeof createInviteRepository>[0];

async function postHandler(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const { roomId } = await context.params; const input = createSchema.parse(await request.json());
    const actorUserId = await getVerifiedInviteActor();
    const repository = createInviteRepository(createSupabaseAdminClient() as unknown as RpcClient);
    const result = await repository.create({ actorUserId, roomId, ...input, ipKey: computeInviteIpKey(request), requestId });
    return NextResponse.json({
      inviteId: result.inviteId,
      token: result.token,
      tokenHint: result.tokenHint,
      grantRole: input.grantRole,
      expiresAt: input.expiresAt,
      maxUses: input.maxUses,
      url: `${new URL(request.url).origin}/join/${result.token}`,
      requestId,
    }, { status: 201 });
  } catch { return NextResponse.json({ message: '초대 링크를 만들 수 없습니다.', requestId }, { status: 400 }); }
}

export const POST = withGeneralRateLimit(postHandler);
