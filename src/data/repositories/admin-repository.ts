import type { ServiceRole } from '@/data/database.types';

type QueryResult<T> = Promise<{ data: T; error: Error | null; count?: number | null }>;
export type AdminClient = { rpc: any; from(table: string): any };

function unwrap<T>(result: { data: unknown; error: Error | null }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

export function createAdminRepository(client: AdminClient, dataClient: AdminClient = client) {
  return {
    async listUsers(offset = 0, limit = 50, requestId: string) {
      return unwrap<{ rows: Array<Record<string, unknown>>; total: number }>(await client.rpc('list_admin_users', {
        p_query: null, p_offset: offset, p_limit: limit, p_request_id: requestId,
      }));
    },
    async lookupUsers(term: string, limit = 20, requestId: string) {
      return unwrap<{ rows: Array<Record<string, unknown>>; total: number }>(await client.rpc('list_admin_users', {
        p_query: term, p_offset: 0, p_limit: limit, p_request_id: requestId,
      }));
    },
    async listRooms(offset = 0, limit = 50) {
      const result = await dataClient.from('scheduling_rooms').select('id, name, owner_user_id, restriction_state, restricted_until, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      return { rows: unwrap<Array<Record<string, unknown>>>(result), total: result.count ?? 0 };
    },
    async listReports(offset = 0, limit = 50) {
      const result = await dataClient.from('reports').select('id, target_type, target_id, reason_code, status, assigned_to_user_id, created_at, resolved_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      return { rows: unwrap<Array<Record<string, unknown>>>(result), total: result.count ?? 0 };
    },
    async listSanctions(offset = 0, limit = 50) {
      const result = await dataClient.from('sanctions').select('id, target_type, target_id, sanction_type, reason, starts_at, ends_at, imposed_by_user_id, released_at', { count: 'exact' }).order('starts_at', { ascending: false }).range(offset, offset + limit - 1);
      return { rows: unwrap<Array<Record<string, unknown>>>(result), total: result.count ?? 0 };
    },
    async listAudit(offset = 0, limit = 50, targetTypes?: string[]) {
      let query = dataClient.from('audit_events').select('id, event_type, actor_type, actor_key, target_type, target_key, result, reason_code, occurred_at', { count: 'exact' }).order('occurred_at', { ascending: false });
      if (targetTypes?.length) query = query.in('target_type', targetTypes);
      const result = await query.range(offset, offset + limit - 1);
      return { rows: unwrap<Array<Record<string, unknown>>>(result), total: result.count ?? 0 };
    },
    async listIpBlocks(offset = 0, limit = 50) {
      const result = await dataClient.from('ip_blocks').select('id, ip_key, blocked_at, blocked_until, source, reason, released_at', { count: 'exact' }).order('blocked_at', { ascending: false }).range(offset, offset + limit - 1);
      return { rows: unwrap<Array<Record<string, unknown>>>(result), total: result.count ?? 0 };
    },
    async listInquiries(actorUserId: string, offset = 0, limit = 50, requestId: string) {
      return unwrap<{ rows: Array<Record<string, unknown>>; total: number; effectiveRole: ServiceRole }>(await client.rpc('list_support_inquiry_metadata', {
        p_actor_user_id: actorUserId, p_offset: offset, p_limit: limit, p_request_id: requestId,
      }));
    },
    async listRequestControlEvents(offset = 0, limit = 50) {
      const result = await dataClient.from('request_control_events').select('id, subject_key, scope, policy, action, request_count, applied_limit, delay_ms, retry_after_seconds, request_id, occurred_at', { count: 'exact' }).order('occurred_at', { ascending: false }).range(offset, offset + limit - 1);
      return { rows: unwrap<Array<Record<string, unknown>>>(result), total: result.count ?? 0 };
    },
    async listRequestPolicies() {
      const result = await dataClient.from('request_control_policies').select('policy, window_seconds, soft_limit, hard_limit, repeated_excess_limit, repeated_excess_window_seconds, block_seconds, delay_min_ms, delay_max_ms, updated_at').order('policy', { ascending: true }).range(0, 99);
      return unwrap<Array<Record<string, unknown>>>(result);
    },
    async expireRequestBlocks(requestId: string) {
      return unwrap<number>(await client.rpc('expire_request_blocks', { p_request_id: requestId }));
    },
    async updateRequestPolicy(input: { policy: 'general' | 'sensitive'; windowSeconds: number; softLimit: number; hardLimit: number; repeatedExcessLimit: number; repeatedExcessWindowSeconds: number; blockSeconds: number; delayMinMs: number; delayMaxMs: number; reason: string; requestId: string }) {
      return unwrap<Record<string, unknown>>(await client.rpc('update_request_control_policy', {
        p_policy: input.policy, p_window_seconds: input.windowSeconds, p_soft_limit: input.softLimit,
        p_hard_limit: input.hardLimit, p_repeated_excess_limit: input.repeatedExcessLimit,
        p_repeated_excess_window_seconds: input.repeatedExcessWindowSeconds, p_block_seconds: input.blockSeconds,
        p_delay_min_ms: input.delayMinMs, p_delay_max_ms: input.delayMaxMs,
        p_reason: input.reason, p_request_id: input.requestId,
      }));
    },
    async applySanction(input: { targetType: 'account' | 'room'; targetId: string; sanctionType: 'restrict' | 'suspend'; reason: string; endsAt: string | null; requestId: string }) {
      return unwrap<string>(await client.rpc('apply_admin_sanction', {
        p_target_type: input.targetType, p_target_id: input.targetId, p_sanction_type: input.sanctionType,
        p_reason: input.reason, p_ends_at: input.endsAt, p_request_id: input.requestId,
      }));
    },
    async releaseSanction(sanctionId: string, reason: string, requestId: string) {
      unwrap(await client.rpc('release_admin_sanction', { p_sanction_id: sanctionId, p_reason: reason, p_request_id: requestId }));
    },
    async grantRole(input: { userId: string; role: ServiceRole; reason: string; requestId: string }) {
      return unwrap<string>(await client.rpc('grant_service_role', {
        p_user_id: input.userId, p_role: input.role, p_reason: input.reason, p_request_id: input.requestId,
      }));
    },
    async revokeRole(input: { assignmentId: string; targetUserId: string; reason: string; requestId: string }) {
      unwrap(await client.rpc('revoke_service_role', {
        p_assignment_id: input.assignmentId, p_target_user_id: input.targetUserId, p_reason: input.reason, p_request_id: input.requestId,
      }));
    },
    async countActiveSuperAdmins() {
      return unwrap<number>(await client.rpc('count_active_super_admins', {}));
    },
    async updateReport(input: { reportId: string; status: 'open' | 'investigating' | 'resolved' | 'dismissed'; assignedToUserId?: string | null; reasonCode: string; requestId: string }) {
      unwrap(await client.rpc('update_admin_report', {
        p_report_id: input.reportId, p_status: input.status, p_assigned_to_user_id: input.assignedToUserId ?? null,
        p_assignment_specified: input.assignedToUserId !== undefined,
        p_reason_code: input.reasonCode, p_request_id: input.requestId,
      }));
    },
    async releaseIpBlock(input: { blockId: string; reason: string; requestId: string }) {
      unwrap(await client.rpc('release_ip_block', { p_block_id: input.blockId, p_reason: input.reason, p_request_id: input.requestId }));
    },
    async recordRead(input: { resource: string; requestId: string; count: number }) {
      unwrap(await client.rpc('record_admin_read', { p_resource: input.resource, p_request_id: input.requestId, p_count: input.count }));
    },
  };
}
