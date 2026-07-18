import { authorizeAdminAction, type AdminAction } from '@/domain/authorization/admin-policy';
import type { ServiceRole } from '@/domain/authorization/capabilities';
import { assertSameOrigin, getOrCreateRequestId } from '@/lib/request-security';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AdminActor = {
  userId: string;
  roles: ServiceRole[];
  lastReauthenticatedAt: string | null;
};

export function requestIdFor(request: Request): string {
  return getOrCreateRequestId(request);
}

export function ensureSameOrigin(request: Request): void {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  assertSameOrigin(request, [siteUrl]);
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profileResult = await supabase.from('profiles').select('account_state, last_reauthenticated_at').eq('id', user.id).single() as unknown as { data: { account_state: string; last_reauthenticated_at: string | null } | null };
  const assignmentsResult = await supabase.from('service_role_assignments').select('role').eq('user_id', user.id).is('revoked_at', null) as unknown as { data: Array<{ role: string }> | null };
  const profile = profileResult.data;
  const assignments = assignmentsResult.data;
  if (!profile || profile.account_state !== 'active') return null;
  const roles = (assignments ?? [])
    .map((assignment) => assignment.role)
    .filter((role): role is ServiceRole => ['super_admin', 'operations_admin', 'support_admin', 'auditor'].includes(role));
  return { userId: user.id, roles, lastReauthenticatedAt: profile.last_reauthenticated_at };
}

export async function requireAdminAction(action: AdminAction): Promise<AdminActor | null> {
  const actor = await getAdminActor();
  return actor && authorizeAdminAction(actor.roles, action) ? actor : null;
}

export function adminDenied(requestId: string) {
  return Response.json({ error: { code: 'admin_access_denied', message: '관리 권한이 없습니다.', requestId } }, { status: 403, headers: { 'X-Request-Id': requestId } });
}

export function adminFailure(requestId: string, code = 'admin_request_failed', status = 400) {
  return Response.json({ error: { code, message: '요청을 처리할 수 없습니다.', requestId } }, { status, headers: { 'X-Request-Id': requestId } });
}

export function adminSuccess(body: unknown, requestId: string, status = 200) {
  return Response.json(body, { status, headers: { 'X-Request-Id': requestId } });
}
