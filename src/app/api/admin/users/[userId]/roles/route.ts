import { z } from 'zod';
import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { canMutateServiceRole } from '@/domain/authorization/admin-policy';
import type { ServiceRole } from '@/domain/authorization/capabilities';
import { adminDenied, adminFailure, adminSuccess, ensureSameOrigin, getAdminActor, requestIdFor } from '@/lib/admin/route-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';

const schema = z.object({ operation: z.enum(['grant', 'revoke']), role: z.enum(['super_admin', 'operations_admin', 'support_admin', 'auditor']), reason: z.string().trim().min(1).max(500), assignmentId: z.string().uuid().optional() });

async function patchHandler(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const requestId = requestIdFor(request);
  try {
    ensureSameOrigin(request);
    const actor = await getAdminActor();
    const payload = schema.parse(await request.json());
    const { userId } = await params;
    const repository = createAdminRepository(await createSupabaseServerClient() as unknown as AdminClient);
    const decision = canMutateServiceRole({ actorRoles: actor?.roles ?? [], lastReauthenticatedAt: actor?.lastReauthenticatedAt, targetRole: payload.role, operation: payload.operation, activeSuperAdminCount: await repository.countActiveSuperAdmins() });
    if (!actor || !decision.allowed) return adminDenied(requestId);
    if (payload.operation === 'grant') {
      const assignmentId = await repository.grantRole({ userId, role: payload.role as ServiceRole, reason: payload.reason, requestId });
      return adminSuccess({ assignmentId, requestId }, requestId, 201);
    }
    if (!payload.assignmentId) return adminFailure(requestId, 'assignment_id_required');
    await repository.revokeRole({ assignmentId: payload.assignmentId, targetUserId: userId, reason: payload.reason, requestId });
    return adminSuccess({ ok: true, requestId }, requestId);
  } catch {
    return adminFailure(requestId);
  }
}

export const PATCH = withGeneralRateLimit(patchHandler);
