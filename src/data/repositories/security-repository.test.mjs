import assert from "node:assert/strict";
import test from "node:test";

import { createSecurityRepository } from "./security-repository.ts";

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
          return {
            eq(column, value) {
              calls.push({ kind: "eq", column, value });
              return {
                is(isColumn, isValue) {
                  calls.push({ kind: "is", column: isColumn, value: isValue });
                  return responses[table] ?? Promise.resolve({ data: [], error: null });
                },
                single() {
                  return responses[table] ?? Promise.resolve({ data: null, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test("profile security lookup selects only lifecycle fields", async () => {
  const client = fakeClient({
    profiles: Promise.resolve({
      data: { id: "user-1", account_state: "active", session_started_at: null, last_seen_at: null, last_reauthenticated_at: null },
      error: null,
    }),
  });
  const repository = createSecurityRepository(client);

  const profile = await repository.getAccountSecurity("user-1");
  assert.equal(profile.account_state, "active");
  assert.equal(client.calls[0].columns.includes("email"), false);
  assert.equal(client.calls[0].columns.includes("phone"), false);
});

test("active service roles exclude revoked assignments", async () => {
  const client = fakeClient({
    service_role_assignments: Promise.resolve({ data: [{ role: "support_admin" }], error: null }),
  });
  const repository = createSecurityRepository(client);

  assert.deepEqual(await repository.getActiveServiceRoles("user-1"), ["support_admin"]);
  assert.deepEqual(client.calls.at(-1), { kind: "is", column: "revoked_at", value: null });
});

test("audit and rate decisions use protected RPCs and propagate failures", async () => {
  const client = fakeClient({
    append_audit_event: { data: "audit-1", error: null },
    evaluate_request_limit: { data: { action: "allow" }, error: null },
  });
  const repository = createSecurityRepository(client);

  assert.equal(await repository.appendAudit({ eventType: "account.login", actorType: "user", actorKey: "user-1", targetType: "account", targetKey: "user-1", result: "success", reasonCode: "login_ok", requestId: "req-1", metadata: {} }), "audit-1");
  assert.deepEqual(await repository.evaluateRequestLimit({ scope: "general_ip", subjectKey: "ip-hmac", policy: "general", requestId: "req-1" }), { action: "allow" });

  const failing = createSecurityRepository(fakeClient({
    append_audit_event: { data: null, error: new Error("database unavailable") },
  }));
  await assert.rejects(() => failing.appendAudit({ eventType: "account.login", actorType: "user", actorKey: "user-1", targetType: "account", targetKey: "user-1", result: "failure", reasonCode: "db_error", requestId: "req-2", metadata: {} }), /database unavailable/);
});
