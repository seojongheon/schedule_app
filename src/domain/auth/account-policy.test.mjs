import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessAccountArea,
  evaluateSessionAge,
  hasRecentAuthentication,
} from "./account-policy.ts";

const now = new Date("2026-07-18T12:00:00.000Z");

test("only active accounts can access protected product areas", () => {
  assert.equal(canAccessAccountArea("active", "product"), true);

  for (const state of [
    "pending_email_verification",
    "pending_profile",
    "pending_guardian_consent",
    "restricted",
    "suspended",
    "deletion_pending",
    "deleted",
  ]) {
    assert.equal(canAccessAccountArea(state, "product"), false, state);
  }
});

test("limited accounts retain only the approved resolution areas", () => {
  for (const state of ["pending_guardian_consent", "restricted", "suspended"]) {
    assert.equal(canAccessAccountArea(state, "support"), true, state);
    assert.equal(canAccessAccountArea(state, "privacy"), true, state);
    assert.equal(canAccessAccountArea(state, "recovery"), true, state);
  }

  assert.equal(canAccessAccountArea("pending_guardian_consent", "guardian_consent"), true);
  assert.equal(canAccessAccountArea("restricted", "guardian_consent"), false);
  assert.equal(canAccessAccountArea("deleted", "support"), false);
  assert.equal(canAccessAccountArea("unknown", "support"), false);
});

test("profile-incomplete accounts can complete onboarding but cannot use product routes", () => {
  assert.equal(canAccessAccountArea("pending_email_verification", "onboarding"), true);
  assert.equal(canAccessAccountArea("pending_profile", "onboarding"), true);
  assert.equal(canAccessAccountArea("pending_profile", "product"), false);
});

test("sessions expire after seven inactive days or thirty absolute days", () => {
  assert.deepEqual(
    evaluateSessionAge({
      now,
      sessionStartedAt: new Date("2026-06-18T12:00:00.000Z"),
      lastActivityAt: new Date("2026-07-11T12:00:00.000Z"),
    }),
    { valid: true },
  );

  assert.deepEqual(
    evaluateSessionAge({
      now,
      sessionStartedAt: new Date("2026-06-18T11:59:59.999Z"),
      lastActivityAt: new Date("2026-07-18T11:00:00.000Z"),
    }),
    { valid: false, reason: "absolute_age_exceeded" },
  );

  assert.deepEqual(
    evaluateSessionAge({
      now,
      sessionStartedAt: new Date("2026-07-01T12:00:00.000Z"),
      lastActivityAt: new Date("2026-07-11T11:59:59.999Z"),
    }),
    { valid: false, reason: "inactivity_exceeded" },
  );
});

test("invalid or future timestamps fail closed", () => {
  assert.deepEqual(
    evaluateSessionAge({ now, sessionStartedAt: "invalid", lastActivityAt: now }),
    { valid: false, reason: "invalid_session_time" },
  );
  assert.deepEqual(
    evaluateSessionAge({
      now,
      sessionStartedAt: new Date("2026-07-18T12:00:01.000Z"),
      lastActivityAt: now,
    }),
    { valid: false, reason: "invalid_session_time" },
  );
});

test("sensitive mutations require authentication within ten minutes", () => {
  assert.equal(hasRecentAuthentication(new Date("2026-07-18T11:50:00.000Z"), now), true);
  assert.equal(hasRecentAuthentication(new Date("2026-07-18T11:49:59.999Z"), now), false);
  assert.equal(hasRecentAuthentication(new Date("2026-07-18T12:00:01.000Z"), now), false);
  assert.equal(hasRecentAuthentication(undefined, now), false);
});
