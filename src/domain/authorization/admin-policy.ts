import { hasRecentAuthentication } from '../auth/account-policy.ts';
import { hasServiceCapability, type ServiceRole } from './capabilities.ts';

export type AdminAction =
  | 'user.read'
  | 'user.lookup'
  | 'user.masked'
  | 'room.read'
  | 'report.read'
  | 'report.write'
  | 'sanction.read'
  | 'sanction.write'
  | 'role.write'
  | 'audit.read'
  | 'ip-block.read'
  | 'ip-block.release'
  | 'request-policy.read'
  | 'request-policy.write'
  | 'inquiry.metadata';

const ACTION_CAPABILITY: Record<AdminAction, string> = {
  'user.read': 'user_room.read',
  'user.lookup': 'user_room.lookup_limited',
  'user.masked': 'user_room.read_masked',
  'room.read': 'user_room.read',
  'report.read': 'report_sanction.read',
  'report.write': 'report_sanction.manage',
  'sanction.read': 'report_sanction.read',
  'sanction.write': 'restriction.manage',
  'role.write': 'service_role.manage',
  'audit.read': 'audit.read_full',
  'ip-block.read': 'ip_block.read',
  'ip-block.release': 'ip_block.release',
  'request-policy.read': 'ip_block.read',
  'request-policy.write': 'restriction.manage',
  'inquiry.metadata': 'inquiry.read_metadata',
};

function rolesHaveCapability(roles: readonly string[], capability: string): boolean {
  return roles.some((role) => hasServiceCapability(role, capability));
}

export function authorizeAdminAction(roles: readonly string[], action: AdminAction): boolean {
  switch (action) {
    case 'report.read':
    case 'sanction.read':
      return rolesHaveCapability(roles, 'report_sanction.read') || rolesHaveCapability(roles, 'report_sanction.manage');
    case 'audit.read':
      return rolesHaveCapability(roles, 'audit.read_full')
        || rolesHaveCapability(roles, 'audit.read_operations')
        || rolesHaveCapability(roles, 'audit.read_support')
        || rolesHaveCapability(roles, 'audit.read_masked');
    case 'ip-block.read':
    case 'request-policy.read':
      return rolesHaveCapability(roles, 'ip_block.read') || rolesHaveCapability(roles, 'ip_block.release');
    case 'room.read':
      return rolesHaveCapability(roles, 'user_room.read') || rolesHaveCapability(roles, 'user_room.read_masked');
    case 'inquiry.metadata':
      return rolesHaveCapability(roles, 'inquiry.read_metadata') || rolesHaveCapability(roles, 'inquiry.read_content');
    default:
      return rolesHaveCapability(roles, ACTION_CAPABILITY[action]);
  }
}

export type AdminSummary = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  accountState: string;
};

function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '비공개';
  return `${trimmed.slice(0, 1)}***`;
}

export function maskAdminSummary(role: string, summary: AdminSummary): AdminSummary {
  if (role === 'auditor') {
    return { id: summary.id, displayName: maskName(summary.displayName), accountState: summary.accountState };
  }
  if (role === 'support_admin') {
    return { id: summary.id, displayName: summary.displayName, accountState: summary.accountState };
  }
  return { ...summary, email: undefined, phone: undefined };
}

type AdminResource = 'rooms' | 'reports' | 'sanctions' | 'ip-blocks' | 'inquiries';

function maskedKey(value: unknown): string {
  const text = String(value ?? '').trim();
  return text ? `${text.slice(0, 1)}***` : '***';
}

export function maskAdminRows(role: string, resource: AdminResource, rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (role !== 'auditor') return rows;
  return rows.map((row) => {
    switch (resource) {
      case 'rooms':
        return { id: row.id, name: `공간 ${maskedKey(row.id)}`, restriction_state: row.restriction_state, created_at: row.created_at };
      case 'reports':
        return { id: row.id, target_type: row.target_type, target_key: maskedKey(row.target_id), reason_code: row.reason_code, status: row.status };
      case 'sanctions':
        return { id: row.id, target_type: row.target_type, target_key: maskedKey(row.target_id), sanction_type: row.sanction_type };
      case 'ip-blocks':
        if (row.record_type === 'event') {
          return { id: row.id, subject_key: maskedKey(row.subject_key), action: row.action, scope: row.scope, occurred_at: row.occurred_at };
        }
        return { id: row.id, subject_key: maskedKey(row.ip_key), source: row.source, status: row.status };
      case 'inquiries':
        return { id: row.id, category: row.category, status: row.status, created_at: row.created_at, updated_at: row.updated_at };
    }
  });
}

export function maskAuditRows(role: string | null, rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (role === 'super_admin' || role === 'operations_admin') return rows;
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    targetType: row.target_type,
    ...(role === 'support_admin' ? { targetKey: row.target_key } : {}),
    result: row.result,
    reasonCode: row.reason_code,
    occurredAt: row.occurred_at,
  }));
}

export type RoleMutationDecision = { allowed: true } | { allowed: false; reason: 'super_admin_required' | 'recent_reauthentication_required' | 'last_super_admin' };

export function canMutateServiceRole(input: {
  actorRoles: readonly string[];
  lastReauthenticatedAt: unknown;
  now?: Date;
  targetRole: string;
  operation: 'grant' | 'revoke';
  activeSuperAdminCount: number;
}): RoleMutationDecision {
  if (!rolesHaveCapability(input.actorRoles, 'service_role.manage')) return { allowed: false, reason: 'super_admin_required' };
  if (!hasRecentAuthentication(input.lastReauthenticatedAt, input.now)) return { allowed: false, reason: 'recent_reauthentication_required' };
  if (input.operation === 'revoke' && input.targetRole === 'super_admin' && input.activeSuperAdminCount <= 1) {
    return { allowed: false, reason: 'last_super_admin' };
  }
  return { allowed: true };
}

export type SanctionValidation = { valid: true } | { valid: false; reason: 'invalid_target' | 'invalid_sanction' | 'reason_required' | 'invalid_end_time' };

export function validateSanctionRequest(input: {
  targetType: string;
  targetId: string;
  sanctionType: string;
  reason: string;
  endsAt: string | null;
}, now = new Date()): SanctionValidation {
  if (!['account', 'room'].includes(input.targetType) || !input.targetId.trim()) return { valid: false, reason: 'invalid_target' };
  if (!['restrict', 'suspend'].includes(input.sanctionType)) return { valid: false, reason: 'invalid_sanction' };
  if (!input.reason.trim() || input.reason.trim().length > 1000) return { valid: false, reason: 'reason_required' };
  if (input.endsAt && (!Number.isFinite(new Date(input.endsAt).getTime()) || new Date(input.endsAt) <= now)) return { valid: false, reason: 'invalid_end_time' };
  return { valid: true };
}

export function primaryServiceRole(roles: readonly string[]): ServiceRole | null {
  const ordered: ServiceRole[] = ['super_admin', 'operations_admin', 'support_admin', 'auditor'];
  return ordered.find((role) => roles.includes(role)) ?? null;
}

export function auditScopeFor(roles: readonly string[]): { targetTypes?: string[]; masked?: true; denied?: true } {
  if (rolesHaveCapability(roles, 'audit.read_full')) return {};
  if (rolesHaveCapability(roles, 'audit.read_operations')) return { targetTypes: ['account', 'room', 'report', 'sanction', 'ip_block'] };
  if (rolesHaveCapability(roles, 'audit.read_support')) return { targetTypes: ['support_inquiry'] };
  if (rolesHaveCapability(roles, 'audit.read_masked')) return { masked: true };
  return { denied: true };
}
