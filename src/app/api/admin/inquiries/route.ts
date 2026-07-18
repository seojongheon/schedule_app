import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { maskAdminRows } from '@/domain/authorization/admin-policy';
import { adminDenied, adminFailure, adminSuccess, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('inquiry.metadata');
    if (!actor) return adminDenied(requestId);
    const page = Math.max(0, Number(new URL(request.url).searchParams.get('page') ?? 0));
    const repository = createAdminRepository(createSupabaseAdminClient() as unknown as AdminClient);
    const result = await repository.listInquiries(actor.userId, page * 50, 50, requestId);
    return adminSuccess({ rows: maskAdminRows(result.effectiveRole, 'inquiries', result.rows), total: result.total, requestId }, requestId);
  } catch {
    return adminFailure(requestId);
  }
}

export const GET = withGeneralRateLimit(getHandler);
