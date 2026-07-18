import { canAccessAccountArea, evaluateSessionAge, type AccountArea } from '@/domain/auth/account-policy';

export function evaluateAccountAccess(input: {
  accountState: string;
  area: AccountArea;
  sessionStartedAt: string | null;
  lastSeenAt: string | null;
  now?: Date;
}): { allowed: true } | { allowed: false; reason: 'account_state_denied' | 'session_expired' } {
  if (!canAccessAccountArea(input.accountState, input.area)) {
    return { allowed: false, reason: 'account_state_denied' };
  }
  const session = evaluateSessionAge({
    now: input.now ?? new Date(),
    sessionStartedAt: input.sessionStartedAt,
    lastActivityAt: input.lastSeenAt,
  });
  return session.valid ? { allowed: true } : { allowed: false, reason: 'session_expired' };
}
