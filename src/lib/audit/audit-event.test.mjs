import assert from "node:assert/strict";
import test from "node:test";

import { buildAuditEvent, redactAuditMetadata } from "./audit-event.ts";

test("audit event construction retains controlled correlation fields", () => {
  const occurredAt = new Date("2026-07-18T12:00:00.000Z");
  const event = buildAuditEvent({
    eventType: "invitation.redeemed",
    actor: { type: "user", id: "user-1" },
    target: { type: "invitation", id: "invite-1" },
    requestId: "req-1",
    occurredAt,
    result: "success",
    reasonCode: "invite_redeemed",
    metadata: { operation: "redeem", role: "member", count: 1 },
  });

  assert.deepEqual(event, {
    eventType: "invitation.redeemed",
    actorType: "user",
    actorId: "user-1",
    targetType: "invitation",
    targetId: "invite-1",
    requestId: "req-1",
    occurredAt: "2026-07-18T12:00:00.000Z",
    result: "success",
    reasonCode: "invite_redeemed",
    metadata: { operation: "redeem", role: "member", count: 1 },
  });
});

test("metadata drops unknown fields and redacts sensitive keys recursively", () => {
  assert.deepEqual(
    redactAuditMetadata({
      operation: "profile_update",
      scope: "self",
      status: "accepted",
      password: "never-log",
      phone: "010-1234-5678",
      token: "raw-token",
      inquiryBody: "private body",
      arbitrary: "not allowlisted",
      details: { address: "private", safe: "still not allowlisted" },
    }),
    { operation: "profile_update", scope: "self", status: "accepted" },
  );
});

test("event construction rejects invalid controlled values and identifiers", () => {
  const base = {
    eventType: "account.updated",
    actor: { type: "user", id: "user-1" },
    target: { type: "account", id: "user-1" },
    requestId: "req-1",
    result: "success",
    reasonCode: "profile_updated",
  };

  assert.throws(() => buildAuditEvent({ ...base, result: "maybe" }), /audit result/i);
  assert.throws(() => buildAuditEvent({ ...base, requestId: "" }), /request id/i);
  assert.throws(
    () => buildAuditEvent({ ...base, eventType: "password.raw" }),
    /event type/i,
  );
});

test("metadata values are bounded and primitive-only", () => {
  assert.deepEqual(
    redactAuditMetadata({
      operation: "x".repeat(500),
      count: 3,
      enabled: true,
      category: ["not", "primitive"],
    }),
    { operation: "x".repeat(200), count: 3, enabled: true },
  );
});
