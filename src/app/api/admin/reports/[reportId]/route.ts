import { z } from 'zod';
import { createAdminRepository, type AdminClient } from '@/data/repositories/admin-repository';
import { adminDenied, adminFailure, adminSuccess, ensureSameOrigin, requireAdminAction, requestIdFor } from '@/lib/admin/route-access';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const updateSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'dismissed']),
  assignedToUserId: z.string().uuid().nullable().optional(),
  reasonCode: z.string().trim().min(1).max(100),
});

async function patchHandler(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = requestIdFor(request);
  try {
    ensureSameOrigin(request);
    const actor = await requireAdminAction('report.write');
    if (!actor) return adminDenied(requestId);
    const [{ reportId }, payload] = await Promise.all([params, request.json().then((body) => updateSchema.parse(body))]);
    if (!z.string().uuid().safeParse(reportId).success) return adminFailure(requestId, 'invalid_report_id');
    await createAdminRepository(await createSupabaseServerClient() as unknown as AdminClient).updateReport({ reportId, ...payload, requestId });
    return adminSuccess({ ok: true, requestId }, requestId);
  } catch {
    return adminFailure(requestId);
  }
}

export const PATCH = withGeneralRateLimit(patchHandler);
