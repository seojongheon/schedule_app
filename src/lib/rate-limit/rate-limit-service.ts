import { setTimeout as delay } from 'node:timers/promises';
import { computeExactMatchHmac } from '@/lib/privacy/encryption';
import { resolveClientIp } from '@/lib/rate-limit/client-ip';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type Decision = { action: 'allow' | 'delay' | 'reject' | 'block'; delay_ms?: number; retry_after?: number };

async function evaluate(scope: string, subjectKey: string, policy: string, requestId: string): Promise<Decision> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('evaluate_request_limit', {
    p_scope: scope,
    p_subject_key: subjectKey,
    p_policy: policy,
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as Decision;
}

async function enforceDecision(decision: Decision): Promise<void> {
  if (decision.action === 'delay') await delay(Math.min(Math.max(decision.delay_ms ?? 1000, 1000), 3000));
  if (decision.action === 'reject' || decision.action === 'block') {
    const error = new Error('Request rate limit exceeded.') as Error & { retryAfter: number };
    error.retryAfter = decision.retry_after ?? 60;
    throw error;
  }
}

export async function enforceSensitiveLimit(input: {
  request: Request;
  requestId: string;
  accountIdentifier?: string;
}): Promise<void> {
  const config = loadSecurityConfig();
  if (!config.securityHmacKey) throw new Error('SECURITY_HMAC_KEY is required for request control.');
  const ip = resolveClientIp(input.request, config.trustedProxyMode);
  const ipKey = computeExactMatchHmac(`ip:${ip}`, config.securityHmacKey);
  await enforceDecision(await evaluate('sensitive_ip', ipKey, 'sensitive', input.requestId));
  if (input.accountIdentifier) {
    const accountKey = computeExactMatchHmac(`account:${input.accountIdentifier}`, config.securityHmacKey);
    await enforceDecision(await evaluate('login_account', accountKey, 'sensitive', input.requestId));
  }
}
