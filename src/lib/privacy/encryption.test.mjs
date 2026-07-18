import assert from "node:assert/strict";
import test from "node:test";

import {
  computeExactMatchHmac,
  decryptPrivateValue,
  encryptPrivateValue,
  normalizeExactMatchValue,
} from "./encryption.ts";

const keys = {
  v1: Buffer.alloc(32, 1).toString("base64"),
  v2: Buffer.alloc(32, 2).toString("base64"),
};
const keyring = { currentVersion: "v2", keys };
const context = { recordId: "profile-123", field: "phone" };

test("private values use a versioned AES-256-GCM envelope and round trip", () => {
  const envelope = encryptPrivateValue("010-1234-5678", context, keyring);

  assert.equal(envelope.algorithm, "aes-256-gcm");
  assert.equal(envelope.keyVersion, "v2");
  assert.equal(Buffer.from(envelope.iv, "base64").byteLength, 12);
  assert.equal(Buffer.from(envelope.tag, "base64").byteLength, 16);
  assert.notEqual(envelope.ciphertext, Buffer.from("010-1234-5678").toString("base64"));
  assert.equal(decryptPrivateValue(envelope, context, keyring), "010-1234-5678");
});

test("encryption uses a fresh IV for identical values", () => {
  const first = encryptPrivateValue("same", context, keyring);
  const second = encryptPrivateValue("same", context, keyring);

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("tampering or binding an envelope to another record fails authentication", () => {
  const envelope = encryptPrivateValue("secret", context, keyring);
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  ciphertext[0] ^= 1;

  assert.throws(
    () => decryptPrivateValue({ ...envelope, ciphertext: ciphertext.toString("base64") }, context, keyring),
    /authenticate private value/i,
  );
  assert.throws(
    () => decryptPrivateValue(envelope, { ...context, recordId: "profile-456" }, keyring),
    /authenticate private value/i,
  );
});

test("historical key versions decrypt while unknown versions fail closed", () => {
  const oldEnvelope = encryptPrivateValue("old", context, { currentVersion: "v1", keys });
  assert.equal(decryptPrivateValue(oldEnvelope, context, keyring), "old");
  assert.throws(
    () => decryptPrivateValue({ ...oldEnvelope, keyVersion: "missing" }, context, keyring),
    /unknown encryption key version/i,
  );
});

test("key material must decode to exactly 256 bits", () => {
  assert.throws(
    () => encryptPrivateValue("value", context, {
      currentVersion: "bad",
      keys: { bad: Buffer.alloc(31).toString("base64") },
    }),
    /256-bit/i,
  );
});

test("exact-match HMAC normalization is deterministic without exposing plaintext", () => {
  assert.equal(normalizeExactMatchValue("  USER@Example.COM  "), "user@example.com");
  assert.equal(normalizeExactMatchValue("ＡＢＣ"), "abc");

  const first = computeExactMatchHmac(" USER@example.com ", keys.v2);
  const second = computeExactMatchHmac("user@example.com", keys.v2);
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes("user@example.com"), false);
});
