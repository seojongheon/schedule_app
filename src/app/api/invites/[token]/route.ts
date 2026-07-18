import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInviteRepository } from '@/data/repositories/invite-repository';
import { computeExactMatchHmac } from '@/lib/privacy/encryption';
import { resolveClientIp } from '@/lib/rate-limit/client-ip';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RpcClient = Parameters<typeof createInviteRepository>[0];
function securityKey(request: Request) {
  const config = loadSecurityConfig();
  if (!config.securityHmacKey) throw new Error('Request security is unavailable.');
  return computeExactMatchHmac(`ip:${resolveClientIp(request, config.trustedProxyMode)}`, config.securityHmacKey);
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    await enforceSensitiveLimit({ request, requestId }); const { token } = await context.params;
    const result = await createInviteRepository(createSupabaseAdminClient() as unknown as RpcClient).preview(token, securityKey(request), requestId);
    return NextResponse.json(result, { status: result.result === 'active' ? 200 : 410 });
  } catch { return NextResponse.json({ result: 'invite_invalid', requestId }, { status: 400 }); }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    await enforceSensitiveLimit({ request, requestId }); const { token } = await context.params;
    const input = z.object({ nickname: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-f]{6}$/i) }).parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const result = await createInviteRepository(supabase as unknown as RpcClient).redeem(token, input.nickname, input.color, securityKey(request), requestId);
    return NextResponse.json(result, { status: result.result === 'invite_redeemed' || result.result === 'already_member' ? 200 : 409 });
  } catch { return NextResponse.json({ result: 'invite_invalid', requestId }, { status: 400 }); }
}
