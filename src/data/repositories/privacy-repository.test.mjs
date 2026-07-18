import assert from "node:assert/strict";
import test from "node:test";

import { createPrivacyRepository } from "./privacy-repository.ts";
import { encryptPrivateValue } from "../../lib/privacy/encryption.ts";

const keys = { v1: Buffer.alloc(32, 1).toString("base64"), v2: Buffer.alloc(32, 2).toString("base64") };
const context = (userId, field) => ({ recordId: userId, field });

function fixture() {
  const row = { userId: "user-1", phone: encryptPrivateValue("01012345678", context("user-1", "phone"), { currentVersion: "v1", keys }), birthDate: encryptPrivateValue("2000-01-01", context("user-1", "birth_date"), { currentVersion: "v1", keys }) };
  const writes = []; const audits = [];
  return {
    row, writes, audits,
    repository: createPrivacyRepository({
      keyring: { currentVersion: "v2", keys },
      store: {
        async read(userId) { return userId === row.userId ? row : null; },
        async write(userId, values) { writes.push({ userId, values }); Object.assign(row, values); },
        async beginWithdrawal(plan) { writes.push({ withdrawal: plan }); },
      },
      audit: async (event) => { audits.push(event); },
    }),
  };
}

test("authorized export decrypts the owner record and audits access without values", async () => {
  const { repository, audits } = fixture();
  assert.deepEqual(await repository.exportProfile("user-1", "user-1", "req-1"), { phone: "01012345678", birthDate: "2000-01-01" });
  assert.deepEqual(audits, [{ eventType: "privacy.profile_accessed", targetUserId: "user-1", requestId: "req-1", fields: ["phone", "birth_date"] }]);
  await assert.rejects(() => repository.exportProfile("user-2", "user-1", "req-2"), /not authorized/i);
});

test("correction encrypts values with the active key and never writes plaintext", async () => {
  const { repository, writes } = fixture();
  await repository.correctPhone("user-1", "user-1", "01099998888", "req-3");
  assert.equal(writes[0].values.phone.keyVersion, "v2");
  assert.equal(JSON.stringify(writes[0]).includes("01099998888"), false);
});

test("key rotation decrypts historical envelopes and rewrites only stale versions", async () => {
  const { repository, writes } = fixture();
  assert.equal(await repository.rotateProfileKeys("user-1", "req-4"), true);
  assert.equal(writes[0].values.phone.keyVersion, "v2");
  assert.equal(writes[0].values.birthDate.keyVersion, "v2");
  assert.equal(await repository.rotateProfileKeys("user-1", "req-5"), false);
});

test("withdrawal persists the seven-day plan and records a value-free audit", async () => {
  const { repository, writes, audits } = fixture();
  const plan = await repository.withdraw("user-1", "user-1", "req-6", new Date("2026-07-18T12:00:00Z"));
  assert.equal(plan.dueAt, "2026-07-25T12:00:00.000Z");
  assert.equal(writes[0].withdrawal.userId, "user-1");
  assert.equal(audits[0].eventType, "privacy.withdrawal_requested");
});
