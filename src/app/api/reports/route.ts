import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { adminFailure, adminSuccess, ensureSameOrigin, requestIdFor } from '@/lib/admin/route-access';
import { encryptPrivateValue } from '@/lib/privacy/encryption';
import { loadSecurityConfig } from '@/lib/security-config';
import { withGeneralRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const reportSchema = z.object({ targetType: z.enum(['account', 'room']), targetId: z.string().uuid(), reasonCode: z.string().trim().min(1).max(100), detail: z.string().trim().max(2000).optional() });

async function postHandler(request: Request) {
  const requestId = requestIdFor(request);
  try {
    ensureSameOrigin(request);
    const payload = reportSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return adminFailure(requestId, 'account_not_active', 403);
    const reportId = randomUUID();
    const config = payload.detail ? loadSecurityConfig() : null;
    const detail = payload.detail && config ? encryptPrivateValue(payload.detail, { recordId: reportId, field: 'detail' }, config.encryption) : null;
    const { data, error } = await supabase.rpc('submit_user_report' as never, {
      p_report_id: reportId,
      p_target_type: payload.targetType,
      p_target_id: payload.targetId,
      p_reason_code: payload.reasonCode,
      p_detail_ciphertext: detail?.ciphertext ?? null,
      p_detail_iv: detail?.iv ?? null,
      p_detail_auth_tag: detail?.tag ?? null,
      p_key_version: detail ? Number(detail.keyVersion.slice(1)) : null,
      p_request_id: requestId,
    } as never) as unknown as { data: { id: string; status: string } | null; error: Error | null };
    if (error || !data) throw error ?? new Error('report creation failed');
    return adminSuccess({ id: data.id, status: data.status, requestId }, requestId, 201);
  } catch {
    return adminFailure(requestId, 'report_submission_failed');
  }
}

export const POST = withGeneralRateLimit(postHandler);
