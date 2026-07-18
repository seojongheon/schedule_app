const WITHDRAWAL_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type WithdrawalPlan = {
  userId: string;
  requestedAt: string;
  dueAt: string;
  revokeSessions: true;
  nextAccountState: 'deletion_pending';
  completedAt?: string;
};

export function createWithdrawalPlan(userId: string, now = new Date()): WithdrawalPlan {
  if (!userId || !Number.isFinite(now.getTime())) throw new Error('Invalid withdrawal request.');
  return {
    userId,
    requestedAt: now.toISOString(),
    dueAt: new Date(now.getTime() + WITHDRAWAL_DAYS_MS).toISOString(),
    revokeSessions: true,
    nextAccountState: 'deletion_pending',
  };
}

export function canCancelWithdrawal(plan: WithdrawalPlan, now = new Date(), irreversibleStarted = false): boolean {
  return !irreversibleStarted && !plan.completedAt && now.getTime() < new Date(plan.dueAt).getTime();
}

export function isDeletionDue(plan: WithdrawalPlan, now = new Date()): boolean {
  return !plan.completedAt && now.getTime() >= new Date(plan.dueAt).getTime();
}

export function reconcileRestoreSubjects(
  records: readonly { subjectKey: string; completedAt: string | null }[],
  restoredSubjectKeys: ReadonlySet<string>,
): string[] {
  return records
    .filter((record) => record.completedAt !== null && restoredSubjectKeys.has(record.subjectKey))
    .map((record) => record.subjectKey)
    .sort();
}

export function retentionUntil(kind: 'inquiry' | 'audit' | 'security', from: Date): Date {
  if (!Number.isFinite(from.getTime())) throw new Error('Retention start time is invalid.');
  const result = new Date(from.getTime());
  if (kind === 'inquiry') result.setUTCFullYear(result.getUTCFullYear() + 3);
  else if (kind === 'audit') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else if (kind === 'security') result.setUTCDate(result.getUTCDate() + 90);
  else throw new Error('Retention kind is invalid.');
  return result;
}
