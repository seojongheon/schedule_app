export const ACCOUNT_STATES = [
  "pending_email_verification",
  "pending_profile",
  "pending_guardian_consent",
  "active",
  "restricted",
  "suspended",
  "deletion_pending",
  "deleted",
] as const;

export type AccountState = (typeof ACCOUNT_STATES)[number];

export const ACCOUNT_AREAS = [
  "onboarding",
  "guardian_consent",
  "product",
  "support",
  "privacy",
  "recovery",
] as const;

export type AccountArea = (typeof ACCOUNT_AREAS)[number];

const STATE_AREA_ACCESS: Record<AccountState, ReadonlySet<AccountArea>> = {
  pending_email_verification: new Set(["onboarding", "privacy", "recovery"]),
  pending_profile: new Set(["onboarding", "privacy", "recovery"]),
  pending_guardian_consent: new Set([
    "guardian_consent",
    "support",
    "privacy",
    "recovery",
  ]),
  active: new Set(["product", "support", "privacy", "recovery"]),
  restricted: new Set(["support", "privacy", "recovery"]),
  suspended: new Set(["support", "privacy", "recovery"]),
  deletion_pending: new Set(["privacy", "recovery"]),
  deleted: new Set(),
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

function toValidTime(value: unknown): number | null {
  const time = value instanceof Date ? value.getTime() : new Date(value as string).getTime();
  return Number.isFinite(time) ? time : null;
}

export function canAccessAccountArea(state: string, area: string): boolean {
  if (!ACCOUNT_STATES.includes(state as AccountState)) return false;
  if (!ACCOUNT_AREAS.includes(area as AccountArea)) return false;
  return STATE_AREA_ACCESS[state as AccountState].has(area as AccountArea);
}

export type SessionAgeResult =
  | { valid: true }
  | {
      valid: false;
      reason: "invalid_session_time" | "absolute_age_exceeded" | "inactivity_exceeded";
    };

export function evaluateSessionAge(input: {
  now: Date;
  sessionStartedAt: unknown;
  lastActivityAt: unknown;
}): SessionAgeResult {
  const now = toValidTime(input.now);
  const started = toValidTime(input.sessionStartedAt);
  const lastActivity = toValidTime(input.lastActivityAt);

  if (
    now === null ||
    started === null ||
    lastActivity === null ||
    started > now ||
    lastActivity > now ||
    lastActivity < started
  ) {
    return { valid: false, reason: "invalid_session_time" };
  }
  if (now - started > THIRTY_DAYS_MS) {
    return { valid: false, reason: "absolute_age_exceeded" };
  }
  if (now - lastActivity > SEVEN_DAYS_MS) {
    return { valid: false, reason: "inactivity_exceeded" };
  }
  return { valid: true };
}

export function hasRecentAuthentication(authenticatedAt: unknown, now = new Date()): boolean {
  const authenticated = toValidTime(authenticatedAt);
  const current = toValidTime(now);
  if (authenticated === null || current === null || authenticated > current) return false;
  return current - authenticated <= TEN_MINUTES_MS;
}
