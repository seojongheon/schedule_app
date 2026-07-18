import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { maskAdminRows, primaryServiceRole } from '@/domain/authorization/admin-policy';
import { adminDenied, adminFailure, adminSuccess, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('report.read');
    if (!actor) return adminDenied(requestId);
    const page = Math.max(0, Number(new URL(request.url).searchParams.get('page') ?? 0));
    const repository = createAdminRepository(
      await createSupabaseServerClient() as unknown as AdminClient,
      createSupabaseAdminClient() as unknown as AdminClient,
    );
    const result = await repository.listReports(page * 50, 50);
    await repository.recordRead({ resource: 'reports', requestId, count: result.rows.length });
    const role = primaryServiceRole(actor.roles) ?? 'auditor';
    return adminSuccess({ rows: maskAdminRows(role, 'reports', result.rows), total: result.total, readonly: !actor.roles.some((item) => ['super_admin', 'operations_admin'].includes(item)), requestId }, requestId);
  } catch { return adminFailure(requestId); }
}

export const GET = withGeneralRateLimit(getHandler);
