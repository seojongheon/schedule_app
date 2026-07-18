import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { maskAdminSummary, primaryServiceRole } from '@/domain/authorization/admin-policy';
import { adminDenied, adminFailure, adminSuccess, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('user.read') ?? await requireAdminAction('user.lookup') ?? await requireAdminAction('user.masked');
    if (!actor) return adminDenied(requestId);
    const page = Math.max(0, Number(new URL(request.url).searchParams.get('page') ?? 0));
    const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    const fullRead = actor.roles.some((role) => ['super_admin', 'operations_admin', 'auditor'].includes(role));
    if (!fullRead && query.length < 2) return adminFailure(requestId, 'lookup_query_required');
    const repository = createAdminRepository(await createSupabaseServerClient() as unknown as AdminClient);
    const result = fullRead ? await repository.listUsers(page * 50, 50, requestId) : await repository.lookupUsers(query, 20, requestId);
    const role = primaryServiceRole(actor.roles) ?? 'auditor';
    const rows = result.rows.map((row) => maskAdminSummary(role, { id: String(row.id), displayName: String(row.display_name ?? ''), accountState: String(row.account_state ?? '') }));
    return adminSuccess({ rows, total: result.total, requestId }, requestId);
  } catch {
    return adminFailure(requestId);
  }
}

export const GET = withGeneralRateLimit(getHandler);
