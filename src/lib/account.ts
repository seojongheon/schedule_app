const LOCAL_ACCOUNT_DOMAIN = 'shared-schedule.local';

export function normalizeLoginIdentifier(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();

  if (trimmed.includes('@')) {
    return trimmed;
  }

  return `${trimmed}@${LOCAL_ACCOUNT_DOMAIN}`;
}

export function loginIdFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const suffix = `@${LOCAL_ACCOUNT_DOMAIN}`;

  if (normalized.endsWith(suffix)) {
    return normalized.slice(0, -suffix.length);
  }

  return normalized;
}
