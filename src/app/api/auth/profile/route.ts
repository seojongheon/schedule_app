import { NextResponse } from 'next/server';
import { profileCompletionSchema } from '@/domain/auth/auth-input';
import { computeExactMatchHmac, encryptPrivateValue } from '@/lib/privacy/encryption';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withSensitiveRateLimit } from '@/lib/rate-limit/with-rate-limit';

function isUnderFourteen(birthDate: string, today = new Date()): boolean {
  const [year, month, day] = birthDate.split('-').map(Number);
  const fourteenth = new Date(Date.UTC(year + 14, month - 1, day));
  return today.getTime() < fourteenth.getTime();
}

async function postHandler(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    const input = profileCompletionSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ message: '인증이 필요합니다.', requestId }, { status: 401 });
    const config = loadSecurityConfig();
    if (!config.securityHmacKey || !config.encryption.keys[config.encryption.currentVersion]) {
      throw new Error('Private-data protection is unavailable.');
    }
    const birth = encryptPrivateValue(input.birthDate, { recordId: user.id, field: 'birth_date' }, config.encryption);
    const phone = input.phone
      ? encryptPrivateValue(input.phone, { recordId: user.id, field: 'phone' }, config.encryption)
      : null;
    const profileRpc = supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: Error | null }>;
    const { data, error } = await profileRpc('complete_commercial_profile', {
      p_display_name: input.displayName,
      p_is_under_14: isUnderFourteen(input.birthDate),
      p_terms_version: input.termsVersion,
      p_privacy_version: input.privacyVersion,
      p_email_lookup_hash: computeExactMatchHmac(user.email, config.securityHmacKey),
      p_phone_ciphertext: phone?.ciphertext ?? null,
      p_phone_iv: phone?.iv ?? null,
      p_phone_auth_tag: phone?.tag ?? null,
      p_phone_lookup_hash: input.phone ? computeExactMatchHmac(input.phone, config.securityHmacKey) : null,
      p_birth_date_ciphertext: birth.ciphertext,
      p_birth_date_iv: birth.iv,
      p_birth_date_auth_tag: birth.tag,
      p_key_version: Number(birth.keyVersion.slice(1)),
      p_request_id: requestId,
    });
    if (error) throw error;
    return NextResponse.json({ accountState: data, next: data === 'active' ? '/dashboard' : '/auth/complete-profile?guardian=required', requestId });
  } catch {
    return NextResponse.json({ message: '프로필을 저장할 수 없습니다.', requestId }, { status: 400 });
  }
}

export const POST = withSensitiveRateLimit(postHandler);
