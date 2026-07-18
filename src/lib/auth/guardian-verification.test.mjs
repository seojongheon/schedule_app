import assert from "node:assert/strict";
import test from "node:test";

import { createGuardianVerificationAdapter } from "./guardian-verification.ts";

test("disabled guardian verification fails closed without retaining contact data", async () => {
  const adapter = createGuardianVerificationAdapter({ mode: "disabled", environment: "production" });
  assert.deepEqual(await adapter.start({ childUserId: "child-1" }), { status: "unavailable" });
  assert.deepEqual(await adapter.verify({ evidenceReference: "evidence" }), { status: "unavailable" });
});

test("deterministic test adapter exposes no guardian provider payload", async () => {
  const adapter = createGuardianVerificationAdapter({ mode: "test", environment: "test" });
  assert.deepEqual(await adapter.start({ childUserId: "child-1" }), { status: "pending", evidenceReference: "test:child-1" });
  assert.deepEqual(await adapter.verify({ evidenceReference: "test:child-1:approve" }), { status: "approved" });
  assert.deepEqual(await adapter.verify({ evidenceReference: "test:child-1:reject" }), { status: "rejected" });
});

test("test guardian adapter is forbidden in production", () => {
  assert.throws(() => createGuardianVerificationAdapter({ mode: "test", environment: "production" }), /forbidden/i);
});
