import { z } from 'zod';
import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { maskAdminRows, primaryServiceRole, validateSanctionRequest } from '@/domain/authorization/admin-policy';
import { adminDenied, adminFailure, adminSuccess, ensureSameOrigin, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

const schema = z.object({ targetType: z.enum(['account', 'room']), targetId: z.string().uuid(), sanctionType: z.enum(['restrict', 'suspend']), reason: z.string().trim().min(1).max(1000), endsAt: z.string().datetime().nullable().optional() });

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('sanction.read');
    if (!actor) return adminDenied(requestId);
    const page = Math.max(0, Number(new URL(request.url).searchParams.get('page') ?? 0));
    const repository = createAdminRepository(
      await createSupabaseServerClient() as unknown as AdminClient,
      createSupabaseAdminClient() as unknown as AdminClient,
    );
    const result = await repository.listSanctions(page * 50, 50);
    await repository.recordRead({ resource: 'sanctions', requestId, count: result.rows.length });
    const role = primaryServiceRole(actor.roles) ?? 'auditor';
    return adminSuccess({ rows: maskAdminRows(role, 'sanctions', result.rows), total: result.total, readonly: !actor.roles.some((item) => ['super_admin', 'operations_admin'].includes(item)), requestId }, requestId);
  } catch { return adminFailure(requestId); }
}

async function postHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    ensureSameOrigin(request);
    const actor = await requireAdminAction('sanction.write');
    if (!actor) return adminDenied(requestId);
    const payload = schema.parse(await request.json());
    if (!validateSanctionRequest({ ...payload, endsAt: payload.endsAt ?? null }).valid) return adminFailure(requestId, 'invalid_sanction');
    const id = await createAdminRepository(await createSupabaseServerClient() as unknown as AdminClient).applySanction({ ...payload, endsAt: payload.endsAt ?? null, requestId });
    return adminSuccess({ id, requestId }, requestId, 201);
  } catch { return adminFailure(requestId); }
}

export const GET = withGeneralRateLimit(getHandler);
export const POST = withGeneralRateLimit(postHandler);
