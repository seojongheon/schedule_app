import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;
const SAFE_CSRF_TOKEN = /^[A-Za-z0-9._~-]{16,256}$/;

export function getOrCreateRequestId(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  return supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

export function assertSameOrigin(request: Request, allowedOrigins: readonly string[]): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  const origin = request.headers.get('origin');
  if (!origin) throw new Error('Request origin is required.');

  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    throw new Error('Request origin is invalid.');
  }

  const allowed = new Set(allowedOrigins.map((value) => new URL(value).origin));
  if (!allowed.has(normalized)) throw new Error('Request origin is not allowed.');
}

function cookieValue(header: string, name: string): string | undefined {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function tokenDigest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function assertCsrfToken(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  const headerToken = request.headers.get('x-csrf-token') ?? '';
  const cookieToken = cookieValue(request.headers.get('cookie') ?? '', 'csrf_token') ?? '';
  const validShape = SAFE_CSRF_TOKEN.test(headerToken) && SAFE_CSRF_TOKEN.test(cookieToken);
  const matches = timingSafeEqual(tokenDigest(headerToken), tokenDigest(cookieToken));
  if (!validShape || !matches) throw new Error('CSRF validation failed.');
}
