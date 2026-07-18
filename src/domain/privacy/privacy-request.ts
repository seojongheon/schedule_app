import { hasRecentAuthentication } from '../auth/account-policy.ts';

type PrivacySession = {
  userId: string;
  lastReauthenticatedAt: string | null;
};

export function assertPrivacyReauthentication(session: PrivacySession | null, now = new Date()): string {
  if (!session?.userId) throw new Error('Authentication is required.');
  if (!hasRecentAuthentication(session.lastReauthenticatedAt, now)) {
    throw new Error('Recent reauthentication is required.');
  }
  return session.userId;
}

export function normalizeOptionalPhone(value: unknown): string | null {
  if (value === undefined) throw new Error('Phone field is required.');
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('Korean mobile phone number is invalid.');
  const normalized = value.replace(/[\s-]/g, '');
  if (!/^010\d{8}$/.test(normalized)) throw new Error('Korean mobile phone number is invalid.');
  return normalized;
}

export function privacyLoginDestination(accountState: string): string | null {
  if (accountState === 'active') return '/dashboard';
  if (accountState === 'deletion_pending') return '/account/withdrawal';
  if (['suspended', 'deleted'].includes(accountState)) return null;
  return '/auth/complete-profile';
}
