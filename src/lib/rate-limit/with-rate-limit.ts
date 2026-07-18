import { RateLimitError } from './rate-limit-service.ts';
import { enforceGeneralLimit, enforceSensitiveLimit } from './rate-limit-service.ts';
import { getOrCreateRequestId } from '../request-security.ts';

export function withRateLimit<Arguments extends unknown[]>(
  handler: (request: Request, ...args: Arguments) => Promise<Response>,
  options: {
    kind: 'general' | 'sensitive' | 'login';
    requestId(request: Request): string;
    check(input: { request: Request; requestId: string; kind: 'general' | 'sensitive' | 'login' }): Promise<{ headers: Record<string, string> }>;
  },
) {
  return async (request: Request, ...args: Arguments): Promise<Response> => {
    const requestId = options.requestId(request);
    try {
      const result = await options.check({ request, requestId, kind: options.kind });
      const response = await handler(request, ...args);
      for (const [name, value] of Object.entries(result.headers)) response.headers.set(name, value);
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error) {
      if (!(error instanceof RateLimitError)) throw error;
      return Response.json({
        error: { code: 'rate_limit_exceeded', message: '요청이 너무 많습니다.', requestId },
      }, { status: 429, headers: { ...error.headers, 'X-Request-Id': requestId } });
    }
  };
}

export function withGeneralRateLimit<Arguments extends unknown[]>(
  handler: (request: Request, ...args: Arguments) => Promise<Response>,
) {
  return withRateLimit(handler, {
    kind: 'general',
    requestId: getOrCreateRequestId,
    check: async ({ request, requestId }) => enforceGeneralLimit({ request, requestId }),
  });
}

export function withSensitiveRateLimit<Arguments extends unknown[]>(
  handler: (request: Request, ...args: Arguments) => Promise<Response>,
) {
  return withRateLimit(handler, {
    kind: 'sensitive',
    requestId: getOrCreateRequestId,
    check: async ({ request, requestId }) => enforceSensitiveLimit({ request, requestId }),
  });
}
