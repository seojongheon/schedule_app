import { isIP } from 'node:net';
import type { TrustedProxyMode } from '@/lib/security-config';

type ClientIpInput = {
  headers: Headers;
  trustedProxyMode: TrustedProxyMode;
  directIp?: string;
  production?: boolean;
};

function normalizedIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim().toLowerCase();
  return isIP(candidate) ? candidate : null;
}

export function resolveClientIp(input: ClientIpInput): string;
export function resolveClientIp(request: Request, trustedProxyMode: TrustedProxyMode): string;
export function resolveClientIp(inputOrRequest: ClientIpInput | Request, legacyMode?: TrustedProxyMode): string {
  const input: ClientIpInput = inputOrRequest instanceof Request
    ? { headers: inputOrRequest.headers, trustedProxyMode: legacyMode ?? 'none', production: process.env.NODE_ENV === 'production' }
    : inputOrRequest;

  let candidate: string | null = null;
  if (input.trustedProxyMode === 'vercel') {
    candidate = normalizedIp(input.headers.get('x-forwarded-for')?.split(',')[0]);
  } else if (input.trustedProxyMode === 'cloudflare') {
    candidate = normalizedIp(input.headers.get('cf-connecting-ip'));
  } else {
    candidate = normalizedIp(input.directIp);
    if (!candidate && input.production === false) candidate = '127.0.0.1';
  }
  if (!candidate) throw new Error('A trusted client IP is unavailable.');
  return candidate;
}
