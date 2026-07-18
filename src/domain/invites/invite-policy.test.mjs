import assert from "node:assert/strict";
import test from "node:test";
import { createInviteToken, hashInviteToken, projectInvitePreview, resolveInviteStatus } from "./invite-policy.ts";

test("invite tokens are high entropy, URL safe, and stored only as hashes", () => {
  const first = createInviteToken(); const second = createInviteToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/); assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashInviteToken(first.token)); assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(first.hint, first.token.slice(-6)); assert.equal(first.tokenHash.includes(first.token), false);
});

test("preview projection exposes only approved fields", () => {
  const preview = projectInvitePreview({ roomName: "Room", roomDescription: "Desc", inviterDisplayName: "User", grantRole: "viewer", expiresAt: "2026-07-20T00:00:00Z", schedules: ["secret"], phone: "secret" });
  assert.deepEqual(preview, { roomName: "Room", roomDescription: "Desc", inviterDisplayName: "User", grantRole: "viewer", expiresAt: "2026-07-20T00:00:00Z" });
});

test("status resolution is stable and fail closed", () => {
  const now = new Date("2026-07-18T00:00:00Z");
  assert.equal(resolveInviteStatus({ status: "revoked", expiresAt: "2026-07-20T00:00:00Z", usedCount: 0, maxUses: 1 }, now), "invite_revoked");
  assert.equal(resolveInviteStatus({ status: "active", expiresAt: "2026-07-17T00:00:00Z", usedCount: 0, maxUses: 1 }, now), "invite_expired");
  assert.equal(resolveInviteStatus({ status: "active", expiresAt: "2026-07-20T00:00:00Z", usedCount: 1, maxUses: 1 }, now), "invite_exhausted");
  assert.equal(resolveInviteStatus({ status: "active", expiresAt: "2026-07-20T00:00:00Z", usedCount: 0, maxUses: 1 }, now), "active");
});
