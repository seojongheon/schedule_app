import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

export type EncryptionContext = {
  recordId: string;
  field: string;
};

export type EncryptionKeyring = {
  currentVersion: string;
  keys: Record<string, string>;
};

export type EncryptedEnvelope = {
  algorithm: "aes-256-gcm";
  keyVersion: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

function decode256BitKey(encodedKey: string | undefined, label: string): Buffer {
  if (!encodedKey) throw new Error(`Unknown ${label} key version.`);
  const key = Buffer.from(encodedKey, "base64");
  if (key.byteLength !== 32) throw new Error(`${label} key must be 256-bit base64.`);
  return key;
}

function contextAad(context: EncryptionContext): Buffer {
  if (!context.recordId || !context.field) {
    throw new Error("Encryption context requires a record ID and field.");
  }
  return Buffer.from(`private-profile\u0000${context.recordId}\u0000${context.field}`, "utf8");
}

export function encryptPrivateValue(
  plaintext: string,
  context: EncryptionContext,
  keyring: EncryptionKeyring,
): EncryptedEnvelope {
  const key = decode256BitKey(keyring.keys[keyring.currentVersion], "encryption");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  cipher.setAAD(contextAad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return {
    algorithm: "aes-256-gcm",
    keyVersion: keyring.currentVersion,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptPrivateValue(
  envelope: EncryptedEnvelope,
  context: EncryptionContext,
  keyring: EncryptionKeyring,
): string {
  if (envelope.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported private value encryption algorithm.");
  }

  const encodedKey = keyring.keys[envelope.keyVersion];
  if (!encodedKey) throw new Error("Unknown encryption key version.");
  const key = decode256BitKey(encodedKey, "encryption");

  try {
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    if (iv.byteLength !== 12 || tag.byteLength !== 16) throw new Error("Invalid envelope.");

    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
    decipher.setAAD(contextAad(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to authenticate private value.");
  }
}

export function normalizeExactMatchValue(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function computeExactMatchHmac(value: string, encodedKey: string): string {
  const key = decode256BitKey(encodedKey, "HMAC");
  return createHmac("sha256", key).update(normalizeExactMatchValue(value), "utf8").digest("hex");
}
