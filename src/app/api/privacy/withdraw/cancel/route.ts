import { computeExactMatchHmac } from '@/lib/privacy/encryption';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePrivacyActor } from '../../_access';
import { privacyFailureFor, privacySuccess } from '../../_response';

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    await enforceSensitiveLimit({ request, requestId });
    const actor = await requirePrivacyActor();
    if (actor.accountState !== 'deletion_pending') throw new Error('Withdrawal is not pending.');
    const config = loadSecurityConfig();
    if (!config.deletionHmacKey) throw new Error('Deletion protection is unavailable.');
    const supabase = await createSupabaseServerClient();
    const privacyRpc = supabase.rpc as unknown as (
      name: string, args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: Error | null }>;
    const { data, error } = await privacyRpc('cancel_account_withdrawal', {
      p_subject_key: computeExactMatchHmac(actor.userId, config.deletionHmacKey),
      p_request_id: requestId,
    });
    if (error || !data) throw error ?? new Error('Withdrawal cancellation failed.');
    return privacySuccess({ accountState: data, next: data === 'active' ? '/dashboard' : '/mypage' }, requestId);
  } catch (error) {
    return privacyFailureFor(error, requestId);
  }
}
