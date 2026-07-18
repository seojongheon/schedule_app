import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { adminDenied, adminFailure, adminSuccess, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function getHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const actor = await requireAdminAction('role.write');
    if (!actor) return adminDenied(requestId);
    const client = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.from('service_role_assignments').select('id, user_id, role, granted_by_user_id, granted_at, revoked_at, reason').order('granted_at', { ascending: false });
    if (error) throw error;
    await createAdminRepository(client as unknown as AdminClient, adminClient as unknown as AdminClient).recordRead({ resource: 'roles', requestId, count: data?.length ?? 0 });
    return adminSuccess({ rows: data ?? [], total: data?.length ?? 0, requestId }, requestId);
  } catch { return adminFailure(requestId); }
}

export const GET = withGeneralRateLimit(getHandler);
