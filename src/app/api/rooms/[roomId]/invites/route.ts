import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInviteRepository } from '@/data/repositories/invite-repository';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createSchema = z.object({ grantRole: z.enum(['member', 'viewer']), expiresAt: z.string().datetime(), maxUses: z.number().int().min(1).max(1000) });
type RpcClient = Parameters<typeof createInviteRepository>[0];

export async function POST(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const { roomId } = await context.params; const input = createSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const repository = createInviteRepository(supabase as unknown as RpcClient);
    const result = await repository.create({ roomId, ...input, requestId });
    return NextResponse.json({ inviteId: result.inviteId, url: `${new URL(request.url).origin}/join/${result.token}` }, { status: 201 });
  } catch { return NextResponse.json({ message: '초대 링크를 만들 수 없습니다.', requestId }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    assertSameOrigin(request, [process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin]);
    const input = z.object({ inviteId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(await request.json());
    const supabase = await createSupabaseServerClient();
    await createInviteRepository(supabase as unknown as RpcClient).revoke(input.inviteId, input.reason, requestId);
    return NextResponse.json({ status: 'revoked' });
  } catch { return NextResponse.json({ message: '초대 링크를 취소할 수 없습니다.', requestId }, { status: 400 }); }
}
