import { decryptPrivateValue } from '@/lib/privacy/encryption';
import { getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePrivacyActor } from '../_access';
import { privacyFailureFor, privacySuccess } from '../_response';

type ExportRow = {
  phone_ciphertext: string | null; phone_iv: string | null; phone_auth_tag: string | null;
  birth_date_ciphertext: string | null; birth_date_iv: string | null; birth_date_auth_tag: string | null;
  key_version: number;
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    await enforceSensitiveLimit({ request, requestId });
    const actor = await requirePrivacyActor();
    const config = loadSecurityConfig();
    const supabase = await createSupabaseServerClient();
    const privacyRpc = supabase.rpc as unknown as (
      name: string, args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>;
    const { data, error } = await privacyRpc('export_private_profile', { p_request_id: requestId });
    if (error) throw error;
    const row = (data as unknown as ExportRow[] | null)?.[0];
    if (!row?.birth_date_ciphertext || !row.birth_date_iv || !row.birth_date_auth_tag) {
      throw new Error('Private profile was not found.');
    }
    const keyVersion = `v${row.key_version}`;
    const phone = row.phone_ciphertext && row.phone_iv && row.phone_auth_tag
      ? decryptPrivateValue({ algorithm: 'aes-256-gcm', keyVersion, ciphertext: row.phone_ciphertext, iv: row.phone_iv, tag: row.phone_auth_tag }, { recordId: actor.userId, field: 'phone' }, config.encryption)
      : null;
    const birthDate = decryptPrivateValue({ algorithm: 'aes-256-gcm', keyVersion, ciphertext: row.birth_date_ciphertext, iv: row.birth_date_iv, tag: row.birth_date_auth_tag }, { recordId: actor.userId, field: 'birth_date' }, config.encryption);
    return privacySuccess({ profile: {
      displayName: actor.displayName, email: actor.email, phone, birthDate,
      accountState: actor.accountState, deletionDueAt: actor.deletionDueAt,
    } }, requestId);
  } catch (error) {
    return privacyFailureFor(error, requestId);
  }
}
