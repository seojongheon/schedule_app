import { z } from 'zod';
import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { adminDenied, adminFailure, adminSuccess, ensureSameOrigin, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

const schema = z.object({ reason: z.string().trim().min(1).max(1000) });

async function postHandler(request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const requestId = requestIdFor(request);
  try {
    ensureSameOrigin(request);
    const actor = await requireAdminAction('ip-block.release');
    if (!actor) return adminDenied(requestId);
    const payload = schema.parse(await request.json());
    const { blockId } = await params;
    await createAdminRepository(await createSupabaseServerClient() as unknown as AdminClient).releaseIpBlock({ blockId, reason: payload.reason, requestId });
    return adminSuccess({ ok: true, requestId }, requestId);
  } catch { return adminFailure(requestId); }
}

export const POST = withGeneralRateLimit(postHandler);
