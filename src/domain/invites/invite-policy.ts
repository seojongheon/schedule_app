import { createHash, randomBytes } from 'node:crypto';

export type InviteGrantRole = 'member' | 'viewer';
export type RoomMembershipRole = 'owner' | 'manager' | InviteGrantRole;

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

type RedemptionSuccess = {
  ok: true;
  status: 200;
  body: { roomId: string; membershipRole: RoomMembershipRole; alreadyMember: boolean };
};

type RedemptionFailure = {
  ok: false;
  status: 400 | 403 | 410;
  body: { code: 'invite_invalid' | 'invite_expired' | 'invite_revoked' | 'invite_replaced' | 'invite_exhausted' | 'account_not_active' };
};

export function mapInviteRedemption(input: Record<string, unknown>): RedemptionSuccess | RedemptionFailure {
  const isGrantedRole = input.role === 'member' || input.role === 'viewer';
  const isExistingRole = isGrantedRole || input.role === 'owner' || input.role === 'manager';
  if (
    ((input.result === 'invite_redeemed' && isGrantedRole)
      || (input.result === 'already_member' && isExistingRole))
    && typeof input.room_id === 'string'
  ) {
    return {
      ok: true,
      status: 200,
      body: {
        roomId: input.room_id,
        membershipRole: input.role as RoomMembershipRole,
        alreadyMember: input.result === 'already_member',
      },
    };
  }

  if (input.result === 'account_not_active') {
    return { ok: false, status: 403, body: { code: input.result } };
  }

  if (
    input.result === 'invite_expired'
    || input.result === 'invite_revoked'
    || input.result === 'invite_replaced'
    || input.result === 'invite_exhausted'
  ) {
    return { ok: false, status: 410, body: { code: input.result } };
  }

  return { ok: false, status: 400, body: { code: 'invite_invalid' } };
}
