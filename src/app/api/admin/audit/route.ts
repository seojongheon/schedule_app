import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { auditScopeFor, maskAuditRows, primaryServiceRole } from '@/domain/authorization/admin-policy';
import { adminDenied, adminFailure, adminSuccess, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('audit.read');
    if (!actor) return adminDenied(requestId);
    const page = Math.max(0, Number(new URL(request.url).searchParams.get('page') ?? 0));
    const scope = auditScopeFor(actor.roles);
    if (scope.denied) return adminDenied(requestId);
    const repository = createAdminRepository(
      await createSupabaseServerClient() as unknown as AdminClient,
      createSupabaseAdminClient() as unknown as AdminClient,
    );
    const result = await repository.listAudit(page * 50, 50, scope.targetTypes);
    await repository.recordRead({ resource: 'audit', requestId, count: result.rows.length });
    const role = primaryServiceRole(actor.roles);
    return adminSuccess({ rows: maskAuditRows(role, result.rows), total: result.total, requestId }, requestId);
  } catch { return adminFailure(requestId); }
}

export const GET = withGeneralRateLimit(getHandler);
