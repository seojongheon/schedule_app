import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRepository } from "./admin-repository.ts";

function fakeClient(responses = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ kind: "rpc", name, args });
      return responses[name] ?? { data: null, error: null };
    },
    from(table) {
      return {
        select(columns) {
          calls.push({ kind: "select", table, columns });
          return { order() {
            const ordered = {
              in(column, values) { calls.push({ kind: "in", table, column, values }); return ordered; },
              range() { return responses[table] ?? { data: [], error: null, count: 0 }; },
            };
            return ordered;
          } };
        },
        insert(value) {
          calls.push({ kind: "insert", table, value });
          return { select() { return { single() { return responses[table] ?? { data: null, error: null }; } }; } };
        },
        update(value) {
          calls.push({ kind: "update", table, value });
          return { eq(column, id) { calls.push({ kind: "eq", table, column, id }); return responses[table] ?? { data: null, error: null }; } };
        },
      };
    },
  };
}

test("sanction application and release use the database transactions", async () => {
  const client = fakeClient({ apply_admin_sanction: { data: "sanction-1", error: null }, release_admin_sanction: { data: null, error: null } });
  const repository = createAdminRepository(client);

  assert.equal(await repository.applySanction({ targetType: "account", targetId: "user-1", sanctionType: "suspend", reason: "정책 위반", endsAt: null, requestId: "request-123" }), "sanction-1");
  await repository.releaseSanction("sanction-1", "상태 확인 후 해제", "request-124");
  assert.deepEqual(client.calls.filter((call) => call.kind === "rpc"), [
    { kind: "rpc", name: "apply_admin_sanction", args: { p_target_type: "account", p_target_id: "user-1", p_sanction_type: "suspend", p_reason: "정책 위반", p_ends_at: null, p_request_id: "request-123" } },
    { kind: "rpc", name: "release_admin_sanction", args: { p_sanction_id: "sanction-1", p_reason: "상태 확인 후 해제", p_request_id: "request-124" } },
  ]);
});

test("administrator user lists come from the database-shaped audited RPC", async () => {
  const client = fakeClient({ list_admin_users: { data: { rows: [{ id: "user-1", display_name: "홍***", account_state: "active" }], total: 1 }, error: null } });
  const repository = createAdminRepository(client);
  assert.equal((await repository.listUsers(0, 50, "request-users")).total, 1);
  assert.equal((await repository.lookupUsers("홍길", 20, "request-lookup")).total, 1);
  assert.deepEqual(client.calls, [
    { kind: "rpc", name: "list_admin_users", args: { p_query: null, p_offset: 0, p_limit: 50, p_request_id: "request-users" } },
    { kind: "rpc", name: "list_admin_users", args: { p_query: "홍길", p_offset: 0, p_limit: 20, p_request_id: "request-lookup" } },
  ]);
});

test("role changes are append-only grants or revocations with an audit event", async () => {
  const client = fakeClient({ grant_service_role: { data: "role-1", error: null }, revoke_service_role: { data: null, error: null } });
  const repository = createAdminRepository(client);

  assert.equal(await repository.grantRole({ userId: "user-2", role: "auditor", reason: "정기 점검", requestId: "request-125" }), "role-1");
  await repository.revokeRole({ assignmentId: "role-1", targetUserId: "user-2", reason: "배정 종료", requestId: "request-126" });

  assert.deepEqual(client.calls, [
    { kind: "rpc", name: "grant_service_role", args: { p_user_id: "user-2", p_role: "auditor", p_reason: "정기 점검", p_request_id: "request-125" } },
    { kind: "rpc", name: "revoke_service_role", args: { p_assignment_id: "role-1", p_target_user_id: "user-2", p_reason: "배정 종료", p_request_id: "request-126" } },
  ]);
});

test("report and IP block changes use one audited database transaction", async () => {
  const client = fakeClient({ update_admin_report: { data: null, error: null }, release_ip_block: { data: null, error: null } });
  const repository = createAdminRepository(client);

  await repository.updateReport({ reportId: "report-1", status: "resolved", assignedToUserId: "staff-1", reasonCode: "verified", requestId: "request-127" });
  await repository.releaseIpBlock({ blockId: "block-1", reason: "false_positive", requestId: "request-128" });

  assert.deepEqual(client.calls, [
    { kind: "rpc", name: "update_admin_report", args: { p_report_id: "report-1", p_status: "resolved", p_assigned_to_user_id: "staff-1", p_assignment_specified: true, p_reason_code: "verified", p_request_id: "request-127" } },
    { kind: "rpc", name: "release_ip_block", args: { p_block_id: "block-1", p_reason: "false_positive", p_request_id: "request-128" } },
  ]);
});

test("administrator inquiry queue contains metadata and the transaction-scoped effective role", async () => {
  const client = fakeClient({ list_support_inquiry_metadata: { data: { rows: [{ id: "inquiry-1", category: "privacy", status: "open", assigned_to_user_id: null, created_at: "2026-07-18", updated_at: "2026-07-18" }], total: 1, effectiveRole: "support_admin" }, error: null } });
  const result = await createAdminRepository(client).listInquiries("actor-1", 0, 50, "request-queue");
  assert.equal(result.total, 1);
  assert.equal(result.effectiveRole, "support_admin");
  assert.deepEqual(client.calls[0], { kind: "rpc", name: "list_support_inquiry_metadata", args: { p_actor_user_id: "actor-1", p_offset: 0, p_limit: 50, p_request_id: "request-queue" } });
});

test("request policy changes use an audited capability-scoped transaction", async () => {
  const client = fakeClient({ update_request_control_policy: { data: { policy: "general", hard_limit: 140 }, error: null } });
  const result = await createAdminRepository(client).updateRequestPolicy({ policy: "general", windowSeconds: 60, softLimit: 100, hardLimit: 140, repeatedExcessLimit: 3, repeatedExcessWindowSeconds: 600, blockSeconds: 900, delayMinMs: 1000, delayMaxMs: 3000, reason: "false positive review", requestId: "request-129" });
  assert.equal(result.hard_limit, 140);
  assert.equal(client.calls[0].name, "update_request_control_policy");
  assert.equal(client.calls[0].args.p_reason, "false positive review");
});

test("request-control history and policies are separately reviewable", async () => {
  const client = fakeClient({
    request_control_events: { data: [{ id: "event-1", subject_key: "hmac", action: "reject" }], error: null, count: 1 },
    request_control_policies: { data: [{ policy: "general", hard_limit: 120 }], error: null },
  });
  const repository = createAdminRepository(client);
  assert.equal((await repository.listRequestControlEvents()).total, 1);
  assert.equal((await repository.listRequestPolicies())[0].hard_limit, 120);
});

test("IP block review records automatic expiries before listing history", async () => {
  const client = fakeClient({ expire_request_blocks: { data: 2, error: null } });
  assert.equal(await createAdminRepository(client).expireRequestBlocks("request-expiry"), 2);
  assert.deepEqual(client.calls[0], { kind: "rpc", name: "expire_request_blocks", args: { p_request_id: "request-expiry" } });
});

test("administrator read models and remaining audited mutations are reachable through scoped methods", async () => {
  const tableResult = { data: [{ id: "row-1" }], error: null, count: 1 };
  const client = fakeClient({
    scheduling_rooms: tableResult, reports: tableResult, sanctions: tableResult,
    audit_events: tableResult, ip_blocks: tableResult,
    count_active_super_admins: { data: 2, error: null },
    update_admin_report: { data: null, error: null },
    record_admin_read: { data: null, error: null },
  });
  const repository = createAdminRepository(client);

  assert.equal((await repository.listRooms(1, 2)).total, 1);
  assert.equal((await repository.listReports()).total, 1);
  assert.equal((await repository.listSanctions()).total, 1);
  assert.equal((await repository.listAudit(0, 10, ["account", "room"])).total, 1);
  assert.equal((await repository.listIpBlocks()).total, 1);
  assert.equal(await repository.countActiveSuperAdmins(), 2);
  await repository.updateReport({ reportId: "report-2", status: "investigating", reasonCode: "triage", requestId: "request-report" });
  await repository.recordRead({ resource: "rooms", requestId: "request-read", count: 1 });

  assert.equal(client.calls.some((call) => call.kind === "in" && call.table === "audit_events"), true);
  const reportCall = client.calls.find((call) => call.name === "update_admin_report");
  assert.equal(reportCall.args.p_assignment_specified, false);
  assert.equal(reportCall.args.p_assigned_to_user_id, null);
});
