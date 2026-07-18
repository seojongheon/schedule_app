import { createInviteToken, hashInviteToken, type InviteGrantRole } from '@/domain/invites/invite-policy';

type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> };
function unwrap<T>({ data, error }: { data: unknown; error: Error | null }): T { if (error) throw error; return data as T; }

export function createInviteRepository(client: RpcClient) {
  return {
    async create(input: { actorUserId: string; roomId: string; grantRole: InviteGrantRole; expiresAt: string; maxUses: number; ipKey: string; requestId: string }) {
      const token = createInviteToken();
      const result = await client.rpc('create_room_invite', {
        p_actor_user_id: input.actorUserId, p_room_id: input.roomId, p_token_hash: token.tokenHash, p_token_hint: token.hint,
        p_grant_role: input.grantRole, p_expires_at: input.expiresAt, p_max_uses: input.maxUses,
        p_ip_key: input.ipKey, p_request_id: input.requestId,
      });
      const inviteId = unwrap<string | null>(result);
      if (!inviteId) throw new Error('Invitation creation was denied.');
      return { inviteId, token: token.token, tokenHint: token.hint };
    },
    async preview(token: string, ipKey: string, requestId: string) {
      return unwrap<Record<string, unknown>>(await client.rpc('preview_room_invite', { p_token_hash: hashInviteToken(token), p_ip_key: ipKey, p_request_id: requestId }));
    },
    async redeem(token: string, nickname: string, color: string, ipKey: string, requestId: string, actorUserId: string) {
      return unwrap<Record<string, unknown>>(await client.rpc('redeem_room_invite', { p_actor_user_id: actorUserId, p_token_hash: hashInviteToken(token), p_nickname: nickname, p_color: color, p_ip_key: ipKey, p_request_id: requestId }));
    },
    async revoke(roomId: string, inviteId: string, reason: string, ipKey: string, requestId: string, actorUserId: string) {
      const revoked = unwrap<boolean>(await client.rpc('revoke_room_invite', {
        p_actor_user_id: actorUserId, p_room_id: roomId, p_invite_id: inviteId, p_reason: reason, p_ip_key: ipKey, p_request_id: requestId,
      }));
      if (!revoked) throw new Error('Invitation revocation was denied.');
    },
    async replace(input: { actorUserId: string; roomId: string; inviteId: string; expiresAt: string; maxUses: number; reason: string; ipKey: string; requestId: string }) {
      const token = createInviteToken();
      const result = await client.rpc('replace_room_invite', {
        p_actor_user_id: input.actorUserId,
        p_room_id: input.roomId,
        p_invite_id: input.inviteId,
        p_token_hash: token.tokenHash,
        p_token_hint: token.hint,
        p_expires_at: input.expiresAt,
        p_max_uses: input.maxUses,
        p_reason: input.reason,
        p_ip_key: input.ipKey,
        p_request_id: input.requestId,
      });
      const inviteId = unwrap<string | null>(result);
      if (!inviteId) throw new Error('Invitation replacement was denied.');
      return { inviteId, token: token.token, tokenHint: token.hint };
    },
  };
}
