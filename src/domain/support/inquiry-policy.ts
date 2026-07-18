export const INQUIRY_CATEGORIES = ['general', 'account', 'consent', 'privacy', 'appeal'] as const;
export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export const INQUIRY_STATUSES = ['open', 'in_progress', 'answered', 'closed'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export type InquiryActor = 'user' | 'support';

const LIMITED_CATEGORIES: InquiryCategory[] = ['account', 'consent', 'privacy', 'appeal'];

export function allowedInquiryCategories(accountState: string): InquiryCategory[] {
  if (accountState === 'active') return [...INQUIRY_CATEGORIES];
  if (['pending_guardian_consent', 'restricted', 'suspended'].includes(accountState)) {
    return [...LIMITED_CATEGORIES];
  }
  return [];
}

export function canCreateInquiry(accountState: string, category: string): boolean {
  return allowedInquiryCategories(accountState).includes(category as InquiryCategory);
}

export function canReplyToInquiry(status: string): boolean {
  return INQUIRY_STATUSES.includes(status as InquiryStatus) && status !== 'closed';
}

export function canReadInquiryContent(input: {
  actorUserId: string;
  ownerUserId: string;
  assignedToUserId: string | null;
  canReadContent: boolean;
}): boolean {
  if (!input.actorUserId || !input.ownerUserId) return false;
  return input.actorUserId === input.ownerUserId
    || (input.canReadContent && input.assignedToUserId === input.actorUserId);
}

export function resolveInquiryTransition(input: { actor: InquiryActor; from: string; to: string }):
  | { allowed: true; closes: boolean }
  | { allowed: false; reason: 'inquiry_transition_denied' } {
  if (input.actor === 'user' && input.from === 'answered' && input.to === 'closed') {
    return { allowed: true, closes: true };
  }
  if (input.actor === 'support' && input.from === 'open' && input.to === 'in_progress') {
    return { allowed: true, closes: false };
  }
  if (input.actor === 'support' && input.from === 'in_progress' && input.to === 'answered') {
    return { allowed: true, closes: false };
  }
  return { allowed: false, reason: 'inquiry_transition_denied' };
}
