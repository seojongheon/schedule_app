import { setTimeout as nodeSleep } from 'node:timers/promises';
import { computeExactMatchHmac } from '../privacy/encryption.ts';
import { resolveClientIp } from './client-ip.ts';
import type { TrustedProxyMode } from '../security-config.ts';
import { loadSecurityConfig } from '../security-config.ts';

export type RateLimitScope = 'general_ip' | 'sensitive_ip' | 'login_account';
export type RateLimitDecision = {
  action: 'allow' | 'delay' | 'reject' | 'block';
  count: number;
  limit: number;
  delayMs?: number;
  retryAfterSeconds: number | null;
  resetAt: string;
};
export type RateLimitStore = {
  evaluate(input: { scope: RateLimitScope; subjectKey: string; policy: 'general' | 'sensitive'; requestId: string }): Promise<RateLimitDecision>;
};

export class RateLimitError extends Error {
  readonly status = 429;
  readonly retryAfter: number;
  readonly headers: Record<string, string>;
  constructor(headers: Record<string, string>, action: 'reject' | 'block') {
    super(`Request ${action}ed by rate control.`);
    this.name = 'RateLimitError';
    this.headers = headers;
    this.retryAfter = Number(headers['Retry-After']);
  }
}

function decisionHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    'RateLimit-Limit': String(decision.limit),
    'RateLimit-Remaining': String(Math.max(0, decision.limit - decision.count)),
    'RateLimit-Reset': decision.resetAt,
    ...(decision.retryAfterSeconds === null ? {} : { 'Retry-After': String(decision.retryAfterSeconds) }),
  };
}

export function createRateLimitService(dependencies: {
  store: RateLimitStore;
  hmacKey: string;
  trustedProxyMode: TrustedProxyMode;
  directIp?: string;
  production?: boolean;
  sleep: (milliseconds: number) => Promise<unknown>;
}) {
  async function evaluate(scope: RateLimitScope, policy: 'general' | 'sensitive', value: string, requestId: string) {
    const subjectKey = computeExactMatchHmac(value, dependencies.hmacKey);
    const decision = await dependencies.store.evaluate({ scope, subjectKey, policy, requestId });
    const headers = decisionHeaders(decision);
    if (decision.action === 'delay') {
      await dependencies.sleep(Math.min(3000, Math.max(1000, decision.delayMs ?? 1000)));
    }
    if (decision.action === 'reject' || decision.action === 'block') {
      throw new RateLimitError(headers, decision.action);
    }
    return { decision, headers };
  }

  return {
    async check(input: { request: Request; requestId: string; kind: 'general' | 'sensitive' | 'login'; accountIdentifier?: string }) {
      const ip = resolveClientIp({
        headers: input.request.headers,
        trustedProxyMode: dependencies.trustedProxyMode,
        directIp: dependencies.directIp,
        production: dependencies.production ?? process.env.NODE_ENV === 'production',
      });
      const kind = input.kind === 'general' ? 'general' : 'sensitive';
      const ipResult = await evaluate(input.kind === 'general' ? 'general_ip' : 'sensitive_ip', kind, `ip:${ip}`, input.requestId);
      if (input.kind === 'login') {
        if (!input.accountIdentifier) throw new Error('Login request control requires an account identifier.');
        return evaluate('login_account', 'sensitive', `account:${input.accountIdentifier}`, input.requestId);
      }
      return ipResult;
    },
  };
}

const databaseStore: RateLimitStore = {
  async evaluate(input) {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('evaluate_request_limit', {
      p_scope: input.scope,
      p_subject_key: input.subjectKey,
      p_policy: input.policy,
      p_request_id: input.requestId,
    });
    if (error) throw error;
    return mapDatabaseDecision(data as DatabaseDecision, input.policy);
  },
};

type DatabaseDecision = {
  action: RateLimitDecision['action'];
  delay_ms?: number;
  retry_after?: number;
  count?: number;
  limit?: number;
  window_seconds?: number;
};

export function mapDatabaseDecision(
  result: DatabaseDecision,
  policy: 'general' | 'sensitive',
  now = new Date(),
): RateLimitDecision {
  const fallbackLimit = policy === 'general' ? 120 : 20;
  const fallbackWindow = policy === 'general' ? 60 : 300;
  const limit = Number.isInteger(result.limit) && Number(result.limit) > 0 ? Number(result.limit) : fallbackLimit;
  const windowSeconds = Number.isInteger(result.window_seconds) && Number(result.window_seconds) > 0
    ? Number(result.window_seconds)
    : fallbackWindow;
  const retryAfterSeconds = result.retry_after ?? null;
  return {
    action: result.action,
    count: result.count ?? (result.action === 'allow' ? 1 : limit + 1),
    limit,
    delayMs: result.delay_ms,
    retryAfterSeconds,
    resetAt: new Date(now.getTime() + (retryAfterSeconds ?? windowSeconds) * 1000).toISOString(),
  };
}

export async function enforceSensitiveLimit(input: { request: Request; requestId: string; accountIdentifier?: string }) {
  const config = loadSecurityConfig();
  if (!config.securityHmacKey) throw new Error('SECURITY_HMAC_KEY is required for request control.');
  const service = createRateLimitService({
    store: databaseStore,
    hmacKey: config.securityHmacKey,
    trustedProxyMode: config.trustedProxyMode,
    sleep: nodeSleep,
  });
  return service.check({ ...input, kind: input.accountIdentifier ? 'login' : 'sensitive' });
}

export async function enforceGeneralLimit(input: { request: Request; requestId: string }) {
  const config = loadSecurityConfig();
  if (!config.securityHmacKey) throw new Error('SECURITY_HMAC_KEY is required for request control.');
  return createRateLimitService({
    store: databaseStore, hmacKey: config.securityHmacKey,
    trustedProxyMode: config.trustedProxyMode, sleep: nodeSleep,
  }).check({ ...input, kind: 'general' });
}
