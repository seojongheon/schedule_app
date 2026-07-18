import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERAL_REQUEST_POLICY,
  SENSITIVE_REQUEST_POLICY,
  decideRequestPolicy,
} from "./policy.ts";

const now = new Date("2026-07-18T12:00:00.000Z");

test("general requests allow 1 through 90 without policy delay", () => {
  for (const count of [1, 90]) {
    assert.deepEqual(
      decideRequestPolicy({ policy: GENERAL_REQUEST_POLICY, count, now }),
      { action: "allow" },
    );
  }
});

test("general requests 91 through 120 receive an injectable one-to-three-second delay", () => {
  assert.deepEqual(
    decideRequestPolicy({ policy: GENERAL_REQUEST_POLICY, count: 91, now, randomFraction: 0 }),
    { action: "delay", delayMs: 1000 },
  );
  assert.deepEqual(
    decideRequestPolicy({ policy: GENERAL_REQUEST_POLICY, count: 120, now, randomFraction: 1 }),
    { action: "delay", delayMs: 3000 },
  );
});

test("general request 121 is rejected with retry guidance", () => {
  assert.deepEqual(
    decideRequestPolicy({
      policy: GENERAL_REQUEST_POLICY,
      count: 121,
      now,
      windowStartedAt: new Date("2026-07-18T11:59:30.000Z"),
    }),
    { action: "reject", retryAfterSeconds: 30, recordHardExcess: true },
  );
});

test("the third hard excess in ten minutes creates a fifteen-minute block", () => {
  assert.deepEqual(
    decideRequestPolicy({
      policy: GENERAL_REQUEST_POLICY,
      count: 121,
      now,
      hardExcessesInTenMinutes: 2,
    }),
    {
      action: "block",
      blockedUntil: "2026-07-18T12:15:00.000Z",
      retryAfterSeconds: 900,
      recordHardExcess: true,
    },
  );
});

test("an existing block is enforced until expiry and then released", () => {
  assert.deepEqual(
    decideRequestPolicy({
      policy: GENERAL_REQUEST_POLICY,
      count: 1,
      now,
      blockedUntil: new Date("2026-07-18T12:01:00.000Z"),
    }),
    { action: "block", blockedUntil: "2026-07-18T12:01:00.000Z", retryAfterSeconds: 60 },
  );
  assert.deepEqual(
    decideRequestPolicy({
      policy: GENERAL_REQUEST_POLICY,
      count: 1,
      now,
      blockedUntil: now,
    }),
    { action: "allow" },
  );
});

test("sensitive requests use twenty attempts per five minutes with no delay band", () => {
  assert.deepEqual(
    decideRequestPolicy({ policy: SENSITIVE_REQUEST_POLICY, count: 20, now }),
    { action: "allow" },
  );
  assert.deepEqual(
    decideRequestPolicy({
      policy: SENSITIVE_REQUEST_POLICY,
      count: 21,
      now,
      windowStartedAt: new Date("2026-07-18T11:58:00.000Z"),
    }),
    { action: "reject", retryAfterSeconds: 180, recordHardExcess: true },
  );
});

test("invalid counters and random values fail closed", () => {
  assert.throws(
    () => decideRequestPolicy({ policy: GENERAL_REQUEST_POLICY, count: -1, now }),
    /request count/i,
  );
  assert.throws(
    () => decideRequestPolicy({ policy: GENERAL_REQUEST_POLICY, count: 91, now, randomFraction: 2 }),
    /random fraction/i,
  );
});
