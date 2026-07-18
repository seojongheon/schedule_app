import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { maskAdminRows, primaryServiceRole } from '@/domain/authorization/admin-policy';
import { adminDenied, adminFailure, adminSuccess, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('ip-block.read');
    if (!actor) return adminDenied(requestId);
    const page = Math.max(0, Number(new URL(request.url).searchParams.get('page') ?? 0));
    const repository = createAdminRepository(
      await createSupabaseServerClient() as unknown as AdminClient,
      createSupabaseAdminClient() as unknown as AdminClient,
    );
    await repository.expireRequestBlocks(requestId);
    const [result, eventResult] = await Promise.all([
      repository.listIpBlocks(page * 50, 50),
      repository.listRequestControlEvents(page * 50, 50),
    ]);
    const now = Date.now();
    const rows: Array<Record<string, unknown>> = [
      ...result.rows.map((row) => ({
        ...row,
        record_type: 'block',
        status: row.released_at ? 'released' : new Date(String(row.blocked_until)).getTime() <= now ? 'expired' : 'active',
      })),
      ...eventResult.rows.map((row) => ({ ...row, record_type: 'event' })),
    ];
    await repository.recordRead({ resource: 'ip-blocks', requestId, count: rows.length });
    const role = primaryServiceRole(actor.roles) ?? 'auditor';
    return adminSuccess({ rows: maskAdminRows(role, 'ip-blocks', rows), total: result.total + eventResult.total, readonly: !actor.roles.some((item) => ['super_admin', 'operations_admin'].includes(item)), requestId }, requestId);
  } catch { return adminFailure(requestId); }
}

export const GET = withGeneralRateLimit(getHandler);
