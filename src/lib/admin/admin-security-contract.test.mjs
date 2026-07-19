import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/20260718120000_commercial_readiness_foundation.sql", import.meta.url);

test("commercial migration removes legacy administrator CRUD and exposes audited atomic mutations", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /drop policy if exists "profiles_service_admin_all" on public\.profiles/i);
  for (const fn of ["grant_service_role", "revoke_service_role", "update_admin_report", "release_ip_block", "submit_user_report"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`, "i"));
  }
  assert.doesNotMatch(sql, /create policy profiles_admin_capability_read/i);
  assert.match(sql, /create or replace function public\.list_admin_users\(/i);
  assert.doesNotMatch(sql, /create policy profiles_admin_capability_write/i);
  assert.match(sql, /revoke_service_role[\s\S]*pg_advisory_xact_lock[\s\S]*service_role:super_admin/i);
  assert.match(sql, /record_admin_read[\s\S]*when 'users' then 'account'[\s\S]*when 'ip-blocks' then 'ip_block'/i);
  for (const policy of [
    'profiles_admin_capability_read', 'scheduling_rooms_admin_capability_read',
    'reports_admin_read', 'sanctions_admin_read', 'audit_events_admin_read',
    'ip_blocks_admin_read', 'request_control_policies_admin_read', 'request_control_events_admin_read',
  ]) assert.doesNotMatch(sql, new RegExp(`create policy ${policy}`, 'i'));
  assert.match(sql, /revoke select on public\.audit_events, public\.sanctions, public\.ip_blocks,[\s\S]*public\.request_control_events from authenticated/i);
});

test("request controls keep pseudonymized decision history and audited configurable defaults", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.request_control_events/i);
  assert.match(sql, /create table public\.request_control_policies/i);
  assert.match(sql, /create or replace function public\.update_request_control_policy\(/i);
  assert.match(sql, /create table public\.request_control_policy_revisions/i);
  assert.match(sql, /insert into public\.request_control_policy_revisions[\s\S]*trim\(p_reason\)/i);
  assert.match(sql, /request_policy\.updated[\s\S]*'reason', left\(trim\(p_reason\), 500\)/i);
  assert.match(sql, /v_key not in \([^)]+\breason\b[^)]+\)/i);
  assert.match(sql, /release_source text[\s\S]*automatic[\s\S]*manual/i);
  for (const action of ["delay", "reject", "block", "automatic_release", "manual_release"]) {
    assert.match(sql, new RegExp(`'${action}'`));
  }
  assert.doesNotMatch(sql, /request_control_events[\s\S]{0,500}\bip_address\b/i);
});

test("request policy route is capability scoped and same-origin protected", async () => {
  const source = await readFile(new URL("../../app/api/admin/ip-blocks/policy/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireAdminAction\(['"]request-policy\.read['"]\)/);
  assert.match(source, /requireAdminAction\(['"]request-policy\.write['"]\)/);
  assert.match(source, /ensureSameOrigin\(request\)/);
  assert.match(source, /updateRequestPolicy/);
});

test("administrator mutations use authenticated RPC context instead of service-role table writes", async () => {
  const repository = await readFile(new URL("../../data/repositories/admin-repository.ts", import.meta.url), "utf8");
  assert.doesNotMatch(repository, /from\(['"](?:service_role_assignments|reports|ip_blocks)['"]\)\.\s*(?:insert|update|delete)/);

  for (const route of [
    "../../app/api/admin/sanctions/route.ts",
    "../../app/api/admin/sanctions/[sanctionId]/release/route.ts",
    "../../app/api/admin/users/[userId]/roles/route.ts",
    "../../app/api/admin/reports/[reportId]/route.ts",
    "../../app/api/admin/ip-blocks/[blockId]/release/route.ts",
  ]) {
    const source = await readFile(new URL(route, import.meta.url), "utf8");
    const mutationSource = source.includes('async function postHandler') ? source.slice(source.indexOf('async function postHandler')) : source;
    assert.match(mutationSource, /createSupabaseServerClient/);
    assert.doesNotMatch(mutationSource, /createSupabaseAdminClient/);
  }
});

test("report mutation follows the nested report contract", async () => {
  const collection = await readFile(new URL("../../app/api/admin/reports/route.ts", import.meta.url), "utf8");
  const member = await readFile(new URL("../../app/api/admin/reports/[reportId]/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(collection, /export const PATCH/);
  assert.match(member, /params:\s*Promise<\{\s*reportId:\s*string\s*\}>/);
  assert.match(member, /updateReport/);
});

test("administrator workspace never exposes privileged password mutation", async () => {
  const sources = await Promise.all([
    readFile(new URL("../../components/admin/AdminWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../components/app/ScheduleWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../data/schedule-supabase.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /reset-password|resetAdminPassword|onResetPassword|adminUsers|updateUserById[\s\S]*password/);
});

test("user reports are submitted through one authenticated transaction", async () => {
  const source = await readFile(new URL("../../app/api/reports/route.ts", import.meta.url), "utf8");
  assert.match(source, /rpc\(['"]submit_user_report['"]/);
  assert.doesNotMatch(source, /from\(['"]reports['"]\)\.insert/);
});

test("administrator workspace exposes inquiry, role, restriction and request-policy operations", async () => {
  const source = await readFile(new URL("../../components/admin/AdminWorkspace.tsx", import.meta.url), "utf8");
  for (const marker of ["/api/admin/inquiries", "/api/admin/roles", "/api/admin/ip-blocks/policy", "역할 부여", "제한 적용", "차단 해제", "문의 배정", "문의 처리", "기준 조정"]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("administrator read routes use a service-only data client after authenticated authorization", async () => {
  for (const route of ["rooms", "reports", "sanctions", "audit", "ip-blocks"]) {
    const source = await readFile(new URL(`../../app/api/admin/${route}/route.ts`, import.meta.url), "utf8");
    assert.match(source, /requireAdminAction/);
    assert.match(source, /createSupabaseAdminClient/);
    assert.match(source, /createAdminRepository\([\s\S]*createSupabaseAdminClient/);
  }
});

test("role assignment listing uses a service-only data client after the super-admin gate", async () => {
  const source = await readFile(new URL("../../app/api/admin/roles/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireAdminAction\(['"]role\.write['"]\)/);
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /createAdminRepository\([\s\S]*recordRead/);
});

test("user password changes require recent or recovery reauthentication and check global sign-out", async () => {
  const source = await readFile(new URL("../../app/api/auth/password/route.ts", import.meta.url), "utf8");
  assert.match(source, /hasRecentAuthentication/);
  assert.match(source, /hasRecentRecoverySession/);
  assert.match(source, /last_reauthenticated_at/);
  assert.match(source, /signOutError/);
});

test("profile session security timestamps are protected and updated only through scoped RPCs", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const triggerStart = sql.indexOf("create or replace function public.prevent_commercial_profile_protected_change");
  const triggerEnd = sql.indexOf("$$;", triggerStart);
  const trigger = sql.slice(triggerStart, triggerEnd);
  for (const column of ["session_started_at", "last_seen_at", "last_reauthenticated_at"]) {
    assert.match(trigger, new RegExp(`new\\.${column} is distinct from old\\.${column}`, "i"));
  }
  assert.match(sql, /create or replace function public\.record_verified_authentication\([\s\S]*?p_actor_user_id uuid[\s\S]*?p_request_id text/i);
  assert.match(sql, /record_verified_authentication[\s\S]*auth\.role\(\) <> 'service_role'/i);
  assert.match(sql, /create or replace function public\.touch_session_activity\([\s\S]*?p_actor_user_id uuid/i);
  assert.match(sql, /touch_session_activity[\s\S]*auth\.role\(\) <> 'service_role'/i);
  assert.match(sql, /grant execute on function public\.record_verified_authentication\(uuid, text\) to service_role/i);
  assert.match(sql, /grant execute on function public\.touch_session_activity\(uuid\) to service_role/i);
  assert.doesNotMatch(sql, /grant execute on function public\.touch_session_activity\(uuid\) to authenticated/i);
});

test("self-service recovery flow exchanges PKCE codes before accepting a new password", async () => {
  const [requestRoute, callbackRoute] = await Promise.all([
    readFile(new URL("../../app/api/auth/recovery/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../app/auth/recovery-callback/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(requestRoute, /auth\/recovery-callback/);
  assert.match(callbackRoute, /exchangeCodeForSession\(code\)/);
  assert.match(callbackRoute, /createSupabaseAdminClient/);
  assert.match(callbackRoute, /record_verified_authentication/);
  assert.match(callbackRoute, /recovery\?mode=change/);
});

test("middleware can update activity only through a service-scoped actor RPC", async () => {
  const source = await readFile(new URL("../../middleware.ts", import.meta.url), "utf8");
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /touch_session_activity/);
  assert.match(source, /p_actor_user_id:\s*(?:identity|user)\.id/);
  assert.doesNotMatch(source, /touch_current_session_activity/);
});

test("inquiry queue RPC never serializes free-text subjects", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const start = sql.indexOf("create or replace function public.list_support_inquiry_metadata");
  const end = sql.indexOf("create or replace function public.create_support_inquiry", start);
  const body = sql.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(body, /select[\s\S]*\bsubject\b/i);
});
