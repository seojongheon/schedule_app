import { normalizeOptionalPhone } from '@/domain/privacy/privacy-request';
import { computeExactMatchHmac, encryptPrivateValue } from '@/lib/privacy/encryption';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePrivacyActor } from '../_access';
import { privacyFailureFor, privacySuccess } from '../_response';

export async function PATCH(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    await enforceSensitiveLimit({ request, requestId });
    const actor = await requirePrivacyActor();
    const phone = normalizeOptionalPhone((await request.json() as { phone?: unknown }).phone);
    const config = loadSecurityConfig();
    if (!config.securityHmacKey || !config.encryption.keys[config.encryption.currentVersion]) {
      throw new Error('Private-data protection is unavailable.');
    }
    const envelope = phone
      ? encryptPrivateValue(phone, { recordId: actor.userId, field: 'phone' }, config.encryption)
      : null;
    const supabase = await createSupabaseServerClient();
    const privacyRpc = supabase.rpc as unknown as (
      name: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>;
    const { error } = await privacyRpc('correct_private_profile_phone', {
      p_phone_ciphertext: envelope?.ciphertext ?? null,
      p_phone_iv: envelope?.iv ?? null,
      p_phone_auth_tag: envelope?.tag ?? null,
      p_phone_lookup_hash: phone ? computeExactMatchHmac(phone, config.securityHmacKey) : null,
      p_key_version: Number(config.encryption.currentVersion.slice(1)),
      p_request_id: requestId,
    });
    if (error) throw error;
    return privacySuccess({ updated: ['phone'] }, requestId);
  } catch (error) {
    return privacyFailureFor(error, requestId);
  }
}
