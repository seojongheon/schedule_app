import { NextResponse } from 'next/server';
import { createInviteRepository } from '@/data/repositories/invite-repository';
import { withSensitiveRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { getOrCreateRequestId } from '@/lib/request-security';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { computeInviteIpKey } from './invite-handlers';

type RpcClient = Parameters<typeof createInviteRepository>[0];
async function previewHandler(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { token } = await context.params;
    const result = await createInviteRepository(createSupabaseAdminClient() as unknown as RpcClient).preview(token, computeInviteIpKey(request), requestId);
    const status = result.result === 'active' ? 200 : result.result === 'invite_invalid' ? 400 : 410;
    return NextResponse.json({ ...result, requestId }, { status });
  } catch { return NextResponse.json({ result: 'invite_invalid', requestId }, { status: 400 }); }
}

export const GET = withSensitiveRateLimit(previewHandler);
