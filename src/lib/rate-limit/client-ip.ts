import type { TrustedProxyMode } from '@/lib/security-config';

function validIp(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (candidate.length < 3 || candidate.length > 64 || !/^[0-9a-f:.]+$/i.test(candidate)) return null;
  return candidate.toLowerCase();
}

export function resolveClientIp(request: Request, mode: TrustedProxyMode): string {
  if (mode === 'vercel') {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0] ?? null;
    const ip = validIp(forwarded);
    if (ip) return ip;
  }
  if (mode === 'cloudflare') {
    const ip = validIp(request.headers.get('cf-connecting-ip'));
    if (ip) return ip;
  }
  if (mode === 'none' && process.env.NODE_ENV !== 'production') return '127.0.0.1';
  throw new Error('A trusted client IP is unavailable.');
}
