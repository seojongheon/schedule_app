import assert from "node:assert/strict";
import test from "node:test";

import {
  canCancelWithdrawal,
  createWithdrawalPlan,
  isDeletionDue,
  reconcileRestoreSubjects,
  retentionUntil,
} from "./privacy-lifecycle.ts";

const now = new Date("2026-07-18T12:00:00.000Z");

test("withdrawal revokes access immediately and schedules deletion seven days later", () => {
  assert.deepEqual(createWithdrawalPlan("user-1", now), {
    userId: "user-1", requestedAt: "2026-07-18T12:00:00.000Z",
    dueAt: "2026-07-25T12:00:00.000Z", revokeSessions: true,
    nextAccountState: "deletion_pending",
  });
});

test("withdrawal cancellation is allowed only before due time and irreversible work", () => {
  const plan = createWithdrawalPlan("user-1", now);
  assert.equal(canCancelWithdrawal(plan, new Date("2026-07-25T11:59:59.999Z"), false), true);
  assert.equal(canCancelWithdrawal(plan, new Date("2026-07-25T12:00:00.000Z"), false), false);
  assert.equal(canCancelWithdrawal(plan, new Date("2026-07-19T12:00:00.000Z"), true), false);
});

test("deletion becomes due at the exact deadline and is idempotent", () => {
  const plan = createWithdrawalPlan("user-1", now);
  assert.equal(isDeletionDue(plan, new Date("2026-07-25T11:59:59.999Z")), false);
  assert.equal(isDeletionDue(plan, new Date("2026-07-25T12:00:00.000Z")), true);
  assert.equal(isDeletionDue({ ...plan, completedAt: "2026-07-25T12:01:00.000Z" }, new Date("2026-07-26T00:00:00Z")), false);
});

test("restore reconciliation returns only completed deletion subjects reintroduced by backup", () => {
  const result = reconcileRestoreSubjects(
    [{ subjectKey: "a", completedAt: "2026-07-20T00:00:00Z" }, { subjectKey: "b", completedAt: null }, { subjectKey: "c", completedAt: "2026-07-21T00:00:00Z" }],
    new Set(["a", "b"]),
  );
  assert.deepEqual(result, ["a"]);
});

test("retention deadlines use the approved three-year, one-year, and ninety-day periods", () => {
  const from = new Date("2026-07-18T12:00:00.000Z");
  assert.equal(retentionUntil("inquiry", from).toISOString(), "2029-07-18T12:00:00.000Z");
  assert.equal(retentionUntil("audit", from).toISOString(), "2027-07-18T12:00:00.000Z");
  assert.equal(retentionUntil("security", from).toISOString(), "2026-10-16T12:00:00.000Z");
  assert.throws(() => retentionUntil("unknown", from), /retention kind/i);
});
