import { z } from 'zod';
import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { adminDenied, adminFailure, adminSuccess, ensureSameOrigin, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  policy: z.enum(['general', 'sensitive']),
  windowSeconds: z.number().int().min(1).max(3600),
  softLimit: z.number().int().min(1).max(10_000),
  hardLimit: z.number().int().min(1).max(10_000),
  repeatedExcessLimit: z.number().int().min(1).max(20),
  repeatedExcessWindowSeconds: z.number().int().min(60).max(86_400),
  blockSeconds: z.number().int().min(60).max(86_400),
  delayMinMs: z.number().int().min(0).max(30_000),
  delayMaxMs: z.number().int().min(0).max(30_000),
  reason: z.string().trim().min(1).max(500),
}).refine((value) => value.hardLimit >= value.softLimit && value.delayMaxMs >= value.delayMinMs, { message: 'Invalid request policy range.' });

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('request-policy.read');
    if (!actor) return adminDenied(requestId);
    const repository = createAdminRepository(
      await createSupabaseServerClient() as unknown as AdminClient,
      createSupabaseAdminClient() as unknown as AdminClient,
    );
    const rows = await repository.listRequestPolicies();
    await repository.recordRead({ resource: 'request-policies', requestId, count: rows.length });
    return adminSuccess({ rows, total: rows.length, readonly: !actor.roles.some((role) => ['super_admin', 'operations_admin'].includes(role)), requestId }, requestId);
  } catch {
    return adminFailure(requestId);
  }
}

async function patchHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    ensureSameOrigin(request);
    const actor = await requireAdminAction('request-policy.write');
    if (!actor) return adminDenied(requestId);
    const input = schema.parse(await request.json());
    const policy = await createAdminRepository(await createSupabaseServerClient() as unknown as AdminClient)
      .updateRequestPolicy({ ...input, requestId });
    return adminSuccess({ policy, requestId }, requestId);
  } catch {
    return adminFailure(requestId, 'request_policy_update_failed');
  }
}

export const GET = withGeneralRateLimit(getHandler);
export const PATCH = withGeneralRateLimit(patchHandler);
