import type { AccountState, ServiceRole } from '@/data/database.types';

type QueryResult<T> = Promise<{ data: T; error: Error | null }>;

type SecurityClient = {
  rpc(name: string, args: Record<string, unknown>): QueryResult<unknown>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): QueryResult<unknown>;
        is(column: string, value: null): QueryResult<unknown>;
      };
    };
  };
};

export type AccountSecurityRecord = {
  id: string;
  account_state: AccountState;
  session_started_at: string | null;
  last_seen_at: string | null;
  last_reauthenticated_at: string | null;
};

export type AuditWrite = {
  eventType: string;
  actorType: 'user' | 'admin' | 'system' | 'anonymous';
  actorKey: string;
  targetType: string;
  targetKey: string;
  result: 'success' | 'denied' | 'failure';
  reasonCode: string;
  requestId: string;
  metadata: Record<string, string | number | boolean>;
};

function unwrap<T>(result: { data: unknown; error: Error | null }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

export function createSecurityRepository(client: SecurityClient) {
  return {
    async getAccountSecurity(userId: string): Promise<AccountSecurityRecord> {
      const result = await client
        .from('profiles')
        .select('id, account_state, session_started_at, last_seen_at, last_reauthenticated_at')
        .eq('id', userId)
        .single();
      return unwrap<AccountSecurityRecord>(result);
    },

    async getActiveServiceRoles(userId: string): Promise<ServiceRole[]> {
      const result = await client
        .from('service_role_assignments')
        .select('role')
        .eq('user_id', userId)
        .is('revoked_at', null);
      return unwrap<Array<{ role: ServiceRole }>>(result).map(({ role }) => role);
    },

    async appendAudit(event: AuditWrite): Promise<string> {
      const result = await client.rpc('append_audit_event', {
        p_event_type: event.eventType,
        p_actor_type: event.actorType,
        p_actor_key: event.actorKey,
        p_target_type: event.targetType,
        p_target_key: event.targetKey,
        p_result: event.result,
        p_reason_code: event.reasonCode,
        p_request_id: event.requestId,
        p_metadata: event.metadata,
      });
      return unwrap<string>(result);
    },

    async evaluateRequestLimit(input: {
      scope: 'general_ip' | 'sensitive_ip' | 'login_account';
      subjectKey: string;
      policy: 'general' | 'sensitive';
      requestId: string;
      now?: string;
    }): Promise<Record<string, unknown>> {
      const result = await client.rpc('evaluate_request_limit', {
        p_scope: input.scope,
        p_subject_key: input.subjectKey,
        p_policy: input.policy,
        p_request_id: input.requestId,
        ...(input.now ? { p_now: input.now } : {}),
      });
      return unwrap<Record<string, unknown>>(result);
    },
  };
}
