import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInviteRepository } from '@/data/repositories/invite-repository';
import { mapInviteRedemption } from '@/domain/invites/invite-policy';
import { computeExactMatchHmac } from '@/lib/privacy/encryption';
import { resolveClientIp } from '@/lib/rate-limit/client-ip';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RpcClient = Parameters<typeof createInviteRepository>[0];

export function computeInviteIpKey(request: Request) {
  const config = loadSecurityConfig();
  if (!config.securityHmacKey) throw new Error('Request security is unavailable.');
  return computeExactMatchHmac(`ip:${resolveClientIp(request, config.trustedProxyMode)}`, config.securityHmacKey);
}

export async function getVerifiedInviteActor() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Authentication is required.');
  return user.id;
}

export async function redeemInviteHandler(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const { token } = await context.params;
    const input = z.object({
      nickname: z.string().trim().min(1).max(80),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
    }).parse(await request.json());
    const actorUserId = await getVerifiedInviteActor();
    const result = await createInviteRepository(createSupabaseAdminClient() as unknown as RpcClient)
      .redeem(token, input.nickname, input.color, computeInviteIpKey(request), requestId, actorUserId);
    const mapped = mapInviteRedemption(result);
    return NextResponse.json({ ...mapped.body, requestId }, { status: mapped.status });
  } catch {
    return NextResponse.json({ code: 'invite_invalid', requestId }, { status: 400 });
  }
}
