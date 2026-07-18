import { computeExactMatchHmac } from '@/lib/privacy/encryption';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { enforceSensitiveLimit } from '@/lib/rate-limit/rate-limit-service';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePrivacyActor } from '../_access';
import { privacyFailureFor, privacySuccess } from '../_response';

export async function POST(request: Request) {
  const requestId = getOrCreateRequestId(request);
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    assertSameOrigin(request, [siteUrl]);
    await enforceSensitiveLimit({ request, requestId });
    const actor = await requirePrivacyActor();
    const config = loadSecurityConfig();
    if (!config.deletionHmacKey) throw new Error('Deletion protection is unavailable.');
    const subjectKey = computeExactMatchHmac(actor.userId, config.deletionHmacKey);
    const supabase = await createSupabaseServerClient();
    const privacyRpc = supabase.rpc as unknown as (
      name: string, args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: Error | null }>;
    const { data, error } = await privacyRpc('begin_account_withdrawal', {
      p_subject_key: subjectKey, p_request_id: requestId,
    });
    if (error || !data) throw error ?? new Error('Withdrawal deadline was not returned.');
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) throw signOutError;
    return privacySuccess({ accountState: 'deletion_pending', deletionDueAt: data, next: '/login?withdrawal=requested' }, requestId, 202);
  } catch (error) {
    return privacyFailureFor(error, requestId);
  }
}
