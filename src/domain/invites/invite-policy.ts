import { createHash, randomBytes } from 'node:crypto';

export type InviteGrantRole = 'member' | 'viewer';

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createInviteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token), hint: token.slice(-6) };
}

export function projectInvitePreview(input: {
  roomName: string; roomDescription: string | null; inviterDisplayName: string;
  grantRole: InviteGrantRole; expiresAt: string; [key: string]: unknown;
}) {
  return {
    roomName: input.roomName, roomDescription: input.roomDescription,
    inviterDisplayName: input.inviterDisplayName, grantRole: input.grantRole, expiresAt: input.expiresAt,
  };
}

export function resolveInviteStatus(input: {
  status: string; expiresAt: string; usedCount: number; maxUses: number;
}, now = new Date()): 'active' | 'invite_revoked' | 'invite_replaced' | 'invite_expired' | 'invite_exhausted' | 'invite_invalid' {
  if (input.status === 'revoked') return 'invite_revoked';
  if (input.status === 'replaced') return 'invite_replaced';
  if (input.status !== 'active') return input.status === 'expired' ? 'invite_expired' : input.status === 'exhausted' ? 'invite_exhausted' : 'invite_invalid';
  if (new Date(input.expiresAt).getTime() <= now.getTime()) return 'invite_expired';
  if (input.usedCount >= input.maxUses) return 'invite_exhausted';
  return 'active';
}
