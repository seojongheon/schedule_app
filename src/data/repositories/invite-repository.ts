import { createInviteToken, hashInviteToken, type InviteGrantRole } from '@/domain/invites/invite-policy';

type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> };
function unwrap<T>({ data, error }: { data: unknown; error: Error | null }): T { if (error) throw error; return data as T; }

export function createInviteRepository(client: RpcClient) {
  return {
    async create(input: { roomId: string; grantRole: InviteGrantRole; expiresAt: string; maxUses: number; requestId: string }) {
      const token = createInviteToken();
      const result = await client.rpc('create_room_invite', {
        p_room_id: input.roomId, p_token_hash: token.tokenHash, p_token_hint: token.hint,
        p_grant_role: input.grantRole, p_expires_at: input.expiresAt, p_max_uses: input.maxUses, p_request_id: input.requestId,
      });
      return { inviteId: unwrap<string>(result), token: token.token };
    },
    async preview(token: string, ipKey: string, requestId: string) {
      return unwrap<Record<string, unknown>>(await client.rpc('preview_room_invite', { p_token_hash: hashInviteToken(token), p_ip_key: ipKey, p_request_id: requestId }));
    },
    async redeem(token: string, nickname: string, color: string, ipKey: string, requestId: string) {
      return unwrap<Record<string, unknown>>(await client.rpc('redeem_room_invite', { p_token_hash: hashInviteToken(token), p_nickname: nickname, p_color: color, p_ip_key: ipKey, p_request_id: requestId }));
    },
    async revoke(inviteId: string, reason: string, requestId: string) {
      unwrap(await client.rpc('revoke_room_invite', { p_invite_id: inviteId, p_reason: reason, p_request_id: requestId }));
    },
  };
}
