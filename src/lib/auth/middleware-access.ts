import { canAccessAccountArea, evaluateSessionAge } from '../../domain/auth/account-policy.ts';

type MiddlewareProfile = {
  accountState: string;
  sessionStartedAt: string | null;
  lastSeenAt: string | null;
};

type MiddlewareDecision =
  | { action: 'allow' }
  | { action: 'redirect'; location: string }
  | { action: 'authentication_required' }
  | { action: 'expire_session' };

function isPublicPath(pathname: string, method: string) {
  if (['/api/auth/login', '/api/auth/register', '/api/auth/recovery'].includes(pathname)) return true;
  if (/^\/api\/auth\/(profile|guardian\/verification)$/.test(pathname)) return true;
  if (/^\/api\/auth\/identities\/[^/]+\/link$/.test(pathname)) return true;
  if (/^\/api\/auth\/provider\/[^/]+\/start$/.test(pathname)) return true;
  if (method === 'GET' && /^\/api\/invites\/[^/]+$/.test(pathname)) return true;
  return !/^\/(dashboard|rooms|mypage|admin|account|support|api)(\/|$)/.test(pathname);
}

export function evaluateMiddlewareAccess(input: {
  pathname: string;
  method?: string;
  authenticated: boolean;
  profile: MiddlewareProfile | null;
  now?: Date;
}): MiddlewareDecision {
  const method = input.method ?? 'GET';
  if (isPublicPath(input.pathname, method)) return { action: 'allow' };
  const isApi = input.pathname.startsWith('/api/');
  if (!input.authenticated || !input.profile) {
    return isApi ? { action: 'authentication_required' } : { action: 'redirect', location: '/login' };
  }
  const session = evaluateSessionAge({
    now: input.now ?? new Date(),
    sessionStartedAt: input.profile.sessionStartedAt,
    lastActivityAt: input.profile.lastSeenAt,
  });
  if (!session.valid) return { action: 'expire_session' };
  if (/^\/(dashboard|rooms|mypage|admin)(\/|$)/.test(input.pathname)
      && !canAccessAccountArea(input.profile.accountState, 'product')) {
    return {
      action: 'redirect',
      location: input.profile.accountState === 'deletion_pending' ? '/account/withdrawal' : '/auth/complete-profile',
    };
  }
  return { action: 'allow' };
}
