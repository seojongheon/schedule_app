import assert from "node:assert/strict";
import test from "node:test";

import { loadSecurityConfig } from "./security-config.ts";

const key = Buffer.alloc(32, 7).toString("base64");

test("production configuration fails closed without private server keys", () => {
  assert.throws(
    () => loadSecurityConfig({ NODE_ENV: "production", PRIVATE_DATA_ACTIVE_KEY_VERSION: "1" }),
    /PRIVATE_DATA_KEY_V1/,
  );
});

test("configuration parses versioned encryption, HMAC, proxy, and provider settings", () => {
  const config = loadSecurityConfig({
    NODE_ENV: "production",
    PRIVATE_DATA_ACTIVE_KEY_VERSION: "2",
    PRIVATE_DATA_KEY_V1: key,
    PRIVATE_DATA_KEY_V2: Buffer.alloc(32, 8).toString("base64"),
    SECURITY_HMAC_KEY: key,
    DELETION_HMAC_KEY: key,
    TRUSTED_PROXY_MODE: "vercel",
    AUTH_CUSTOM_GOOGLE_PROVIDER: "custom:google",
    AUTH_GOOGLE_ENABLED: "true",
    AUTH_CUSTOM_KAKAO_PROVIDER: "custom:kakao",
    AUTH_KAKAO_ENABLED: "false",
    AUTH_CUSTOM_NAVER_PROVIDER: "custom:naver",
    AUTH_NAVER_ENABLED: "true",
    GUARDIAN_VERIFICATION_MODE: "disabled",
  });

  assert.equal(config.encryption.currentVersion, "v2");
  assert.deepEqual(Object.keys(config.encryption.keys), ["v1", "v2"]);
  assert.equal(config.trustedProxyMode, "vercel");
  assert.equal(config.providers.kakao.enabled, false);
  assert.equal(config.providers.naver.provider, "custom:naver");
  assert.equal(config.guardianVerificationMode, "disabled");
});

test("invalid keys, provider names, booleans, and proxy modes are rejected", () => {
  const base = {
    NODE_ENV: "production",
    PRIVATE_DATA_ACTIVE_KEY_VERSION: "1",
    PRIVATE_DATA_KEY_V1: key,
    SECURITY_HMAC_KEY: key,
    DELETION_HMAC_KEY: key,
    TRUSTED_PROXY_MODE: "none",
    GUARDIAN_VERIFICATION_MODE: "disabled",
  };
  assert.throws(() => loadSecurityConfig({ ...base, SECURITY_HMAC_KEY: "short" }), /256-bit/);
  assert.throws(() => loadSecurityConfig({ ...base, TRUSTED_PROXY_MODE: "trust-all" }), /TRUSTED_PROXY_MODE/);
  assert.throws(() => loadSecurityConfig({ ...base, AUTH_GOOGLE_ENABLED: "yes" }), /AUTH_GOOGLE_ENABLED/);
  assert.throws(() => loadSecurityConfig({ ...base, AUTH_GOOGLE_ENABLED: "true" }), /AUTH_CUSTOM_GOOGLE_PROVIDER/);
});
