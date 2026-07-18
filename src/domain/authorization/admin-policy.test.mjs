import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeAdminAction,
  canMutateServiceRole,
  auditScopeFor,
  maskAdminSummary,
  maskAdminRows,
  maskAuditRows,
  validateSanctionRequest,
} from "./admin-policy.ts";

test("administrator actions fail closed and follow the capability matrix", () => {
  assert.equal(authorizeAdminAction(["operations_admin"], "sanction.write"), true);
  assert.equal(authorizeAdminAction(["operations_admin"], "role.write"), false);
  assert.equal(authorizeAdminAction(["support_admin"], "user.lookup"), true);
  assert.equal(authorizeAdminAction(["support_admin"], "user.read"), false);
  assert.equal(authorizeAdminAction(["auditor"], "audit.read"), true);
  assert.equal(authorizeAdminAction(["operations_admin"], "request-policy.write"), true);
  assert.equal(authorizeAdminAction(["auditor"], "request-policy.write"), false);
  assert.equal(authorizeAdminAction(["support_admin"], "inquiry.metadata"), true);
  assert.equal(authorizeAdminAction(["auditor"], "inquiry.metadata"), true);
  assert.equal(authorizeAdminAction(["unknown"], "audit.read"), false);
  assert.equal(authorizeAdminAction([], "report.read"), false);
});

test("support and auditor audit rows omit actor identifiers and unsupported detail", () => {
  const row = { id: "audit-1", event_type: "inquiry.content_read", actor_type: "admin", actor_key: "user-private", target_type: "support_inquiry", target_key: "inquiry-1", result: "success", reason_code: "read", occurred_at: "2026-07-18" };
  assert.deepEqual(maskAuditRows("support_admin", [row]), [{ id: "audit-1", eventType: "inquiry.content_read", targetType: "support_inquiry", targetKey: "inquiry-1", result: "success", reasonCode: "read", occurredAt: "2026-07-18" }]);
  assert.deepEqual(maskAuditRows("auditor", [row]), [{ id: "audit-1", eventType: "inquiry.content_read", targetType: "support_inquiry", result: "success", reasonCode: "read", occurredAt: "2026-07-18" }]);
});

test("every limited administrator output is shaped before serialization", () => {
  const room = maskAdminRows("auditor", "rooms", [{ id: "room-1", name: "비공개 일정", owner_user_id: "user-1", restriction_state: "active", created_at: "2026-07-18" }]);
  const report = maskAdminRows("auditor", "reports", [{ id: "report-1", target_type: "account", target_id: "user-1", reason_code: "spam", status: "open", assigned_to_user_id: "staff-1" }]);
  const sanction = maskAdminRows("auditor", "sanctions", [{ id: "sanction-1", target_type: "account", target_id: "user-1", reason: "private detail", sanction_type: "restrict" }]);
  const block = maskAdminRows("auditor", "ip-blocks", [{ id: "block-1", ip_key: "secret-hmac", reason: "automatic", source: "automatic", status: "active" }]);
  const event = maskAdminRows("auditor", "ip-blocks", [{ id: "event-1", record_type: "event", subject_key: "secret-hmac", action: "reject", scope: "general_ip", occurred_at: "2026-07-18" }]);

  assert.deepEqual(room, [{ id: "room-1", name: "공간 r***", restriction_state: "active", created_at: "2026-07-18" }]);
  assert.deepEqual(report, [{ id: "report-1", target_type: "account", target_key: "u***", reason_code: "spam", status: "open" }]);
  assert.deepEqual(sanction, [{ id: "sanction-1", target_type: "account", target_key: "u***", sanction_type: "restrict" }]);
  assert.deepEqual(block, [{ id: "block-1", subject_key: "s***", source: "automatic", status: "active" }]);
  assert.deepEqual(event, [{ id: "event-1", subject_key: "s***", action: "reject", scope: "general_ip", occurred_at: "2026-07-18" }]);
});

test("auditor summaries mask personal identifiers and never expose internal contact data", () => {
  const masked = maskAdminSummary("auditor", {
    id: "user-12345678",
    displayName: "홍길동",
    email: "private@example.com",
    phone: "010-1234-5678",
    accountState: "active",
  });

  assert.deepEqual(masked, {
    id: "user-12345678",
    displayName: "홍***",
    accountState: "active",
  });
  assert.equal("email" in masked, false);
  assert.equal("phone" in masked, false);
});

test("role changes require recent reauthentication and preserve the final super administrator", () => {
  assert.deepEqual(canMutateServiceRole({
    actorRoles: ["super_admin"],
    lastReauthenticatedAt: "2026-07-18T11:51:00.000Z",
    now: new Date("2026-07-18T12:00:00.000Z"),
    targetRole: "operations_admin",
    operation: "grant",
    activeSuperAdminCount: 1,
  }), { allowed: true });

  assert.deepEqual(canMutateServiceRole({
    actorRoles: ["super_admin"],
    lastReauthenticatedAt: "2026-07-18T11:49:59.999Z",
    now: new Date("2026-07-18T12:00:00.000Z"),
    targetRole: "operations_admin",
    operation: "grant",
    activeSuperAdminCount: 1,
  }), { allowed: false, reason: "recent_reauthentication_required" });

  assert.deepEqual(canMutateServiceRole({
    actorRoles: ["super_admin"],
    lastReauthenticatedAt: "2026-07-18T11:51:00.000Z",
    now: new Date("2026-07-18T12:00:00.000Z"),
    targetRole: "super_admin",
    operation: "revoke",
    activeSuperAdminCount: 1,
  }), { allowed: false, reason: "last_super_admin" });
});

test("sanction requests require a bounded reason and future end time", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  assert.deepEqual(validateSanctionRequest({
    targetType: "room", targetId: "room-1", sanctionType: "restrict", reason: "반복된 운영 정책 위반", endsAt: "2026-07-19T12:00:00.000Z",
  }, now), { valid: true });
  assert.equal(validateSanctionRequest({
    targetType: "room", targetId: "room-1", sanctionType: "restrict", reason: " ", endsAt: null,
  }, now).valid, false);
  assert.equal(validateSanctionRequest({
    targetType: "account", targetId: "user-1", sanctionType: "suspend", reason: "정책 위반", endsAt: "2026-07-18T11:59:59.000Z",
  }, now).valid, false);
});

test("limited service roles receive only their approved audit scope", () => {
  assert.deepEqual(auditScopeFor(["support_admin"]), { targetTypes: ["support_inquiry"] });
  assert.deepEqual(auditScopeFor(["auditor"]), { masked: true });
  assert.deepEqual(auditScopeFor(["operations_admin"]), { targetTypes: ["account", "room", "report", "sanction", "ip_block"] });
  assert.deepEqual(auditScopeFor(["unknown"]), { denied: true });
});

test("every administrator route gate has a role-scoped decision", () => {
  const routeActions = ["user.read", "user.lookup", "user.masked", "room.read", "report.read", "report.write", "sanction.read", "sanction.write", "role.write", "audit.read", "ip-block.read", "ip-block.release", "request-policy.read", "request-policy.write"];
  const allowed = {
    super_admin: routeActions,
    operations_admin: ["user.read", "room.read", "report.read", "report.write", "sanction.read", "sanction.write", "audit.read", "ip-block.read", "ip-block.release", "request-policy.read", "request-policy.write"],
    support_admin: ["user.lookup", "audit.read"],
    auditor: ["user.masked", "room.read", "report.read", "sanction.read", "audit.read", "ip-block.read", "request-policy.read"],
  };

  for (const [role, permitted] of Object.entries(allowed)) {
    for (const action of routeActions) {
      assert.equal(authorizeAdminAction([role], action), permitted.includes(action), `${role} ${action}`);
    }
  }
});
