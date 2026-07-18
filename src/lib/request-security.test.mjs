import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCsrfToken,
  assertSameOrigin,
  getOrCreateRequestId,
} from "./request-security.ts";

test("request IDs preserve safe correlation IDs and replace malformed input", () => {
  const safe = new Request("https://service.example/api/test", { headers: { "x-request-id": "req_12345678" } });
  assert.equal(getOrCreateRequestId(safe), "req_12345678");

  const malformed = new Request("https://service.example/api/test", { headers: { "x-request-id": "../../secret:value" } });
  const generated = getOrCreateRequestId(malformed);
  assert.match(generated, /^[0-9a-f-]{36}$/);
  assert.equal(getOrCreateRequestId(malformed), generated);
});

test("unsafe browser requests require an exact allowed origin", () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request("https://service.example/api", {
    method: "POST",
    headers: { origin: "https://service.example" },
  }), ["https://service.example"]));

  assert.throws(() => assertSameOrigin(new Request("https://service.example/api", {
    method: "POST",
    headers: { origin: "https://evil.example" },
  }), ["https://service.example"]), /origin/i);
  assert.throws(() => assertSameOrigin(new Request("https://service.example/api", { method: "DELETE" }), ["https://service.example"]), /origin/i);
  assert.doesNotThrow(() => assertSameOrigin(new Request("https://service.example/api"), []));
});

test("CSRF double-submit checks are constant-shape and fail closed", () => {
  const valid = new Request("https://service.example/api", {
    method: "POST",
    headers: { "x-csrf-token": "token_1234567890123456", cookie: "csrf_token=token_1234567890123456" },
  });
  assert.doesNotThrow(() => assertCsrfToken(valid));

  const invalid = new Request("https://service.example/api", {
    method: "POST",
    headers: { "x-csrf-token": "token_1234567890123456", cookie: "csrf_token=different_1234567890" },
  });
  assert.throws(() => assertCsrfToken(invalid), /CSRF/);
  assert.throws(() => assertCsrfToken(new Request("https://service.example/api", { method: "POST" })), /CSRF/);
  assert.doesNotThrow(() => assertCsrfToken(new Request("https://service.example/api")));
});
