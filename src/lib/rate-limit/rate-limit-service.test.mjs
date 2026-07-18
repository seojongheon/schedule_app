import assert from "node:assert/strict";
import test from "node:test";

import {
  RateLimitError, createRateLimitService, enforceGeneralLimit, enforceSensitiveLimit, mapDatabaseDecision,
} from "./rate-limit-service.ts";

const key = Buffer.alloc(32, 4).toString("base64");
const request = new Request("https://service.example/api", { headers: { "x-forwarded-for": "203.0.113.7" } });

test("shared-store allow decisions include standard non-sensitive headers", async () => {
  const calls = [];
  const service = createRateLimitService({
    hmacKey: key, trustedProxyMode: "vercel",
    store: { async evaluate(input) { calls.push(input); return { action: "allow", count: 3, limit: 120, retryAfterSeconds: null, resetAt: "2026-07-18T12:01:00.000Z" }; } },
    sleep: async () => {},
  });
  const result = await service.check({ request, requestId: "req-1", kind: "general" });
  assert.equal(calls[0].scope, "general_ip");
  assert.notEqual(calls[0].subjectKey, "203.0.113.7");
  assert.deepEqual(result.headers, { "RateLimit-Limit": "120", "RateLimit-Remaining": "117", "RateLimit-Reset": "2026-07-18T12:01:00.000Z" });
});

test("delay uses the injected sleeper and preserves the decision headers", async () => {
  const sleeps = [];
  const service = createRateLimitService({
    hmacKey: key, trustedProxyMode: "vercel",
    store: { async evaluate() { return { action: "delay", count: 91, limit: 120, delayMs: 2500, retryAfterSeconds: null, resetAt: "reset" }; } },
    sleep: async (ms) => { sleeps.push(ms); },
  });
  await service.check({ request, requestId: "req-2", kind: "general" });
  assert.deepEqual(sleeps, [2500]);
});

test("login evaluates IP and account keys independently", async () => {
  const scopes = [];
  const service = createRateLimitService({
    hmacKey: key, trustedProxyMode: "vercel",
    store: { async evaluate(input) { scopes.push(input.scope); return { action: "allow", count: 1, limit: 20, retryAfterSeconds: null, resetAt: "reset" }; } },
    sleep: async () => {},
  });
  await service.check({ request, requestId: "req-3", kind: "login", accountIdentifier: "User@Example.com" });
  assert.deepEqual(scopes, ["sensitive_ip", "login_account"]);
});

test("reject and block decisions throw typed 429 errors with Retry-After", async () => {
  for (const action of ["reject", "block"]) {
    const service = createRateLimitService({
      hmacKey: key, trustedProxyMode: "vercel",
      store: { async evaluate() { return { action, count: 121, limit: 120, retryAfterSeconds: 60, resetAt: "reset" }; } },
      sleep: async () => {},
    });
    await assert.rejects(() => service.check({ request, requestId: "req-4", kind: "general" }), (error) => {
      assert.equal(error instanceof RateLimitError, true);
      assert.equal(error.status, 429); assert.equal(error.headers["Retry-After"], "60"); return true;
    });
  }
});

test("an account rejection stops login even when the IP check allowed", async () => {
  let call = 0;
  const service = createRateLimitService({
    hmacKey: key, trustedProxyMode: "vercel",
    store: { async evaluate() { call += 1; return call === 1
      ? { action: "allow", count: 1, limit: 20, retryAfterSeconds: null, resetAt: "reset" }
      : { action: "reject", count: 21, limit: 20, retryAfterSeconds: 300, resetAt: "reset" }; } },
    sleep: async () => {},
  });
  await assert.rejects(() => service.check({ request, requestId: "req-5", kind: "login", accountIdentifier: "user@example.com" }), RateLimitError);
});

test('separate service instances enforce the same shared counter at 90, 120, and 121', async () => {
  let count = 0;
  const store = {
    async evaluate() {
      count += 1;
      if (count <= 90) return { action: 'allow', count, limit: 120, retryAfterSeconds: null, resetAt: 'reset' };
      if (count <= 120) return { action: 'delay', count, limit: 120, delayMs: 1000, retryAfterSeconds: null, resetAt: 'reset' };
      return { action: 'reject', count, limit: 120, retryAfterSeconds: 30, resetAt: 'reset' };
    },
  };
  const create = () => createRateLimitService({ hmacKey: key, trustedProxyMode: 'vercel', store, sleep: async () => {} });
  const first = create();
  const second = create();
  for (let index = 1; index <= 90; index += 1) {
    const result = await (index % 2 ? first : second).check({ request, requestId: `req-${index}`, kind: 'general' });
    assert.equal(result.decision.action, 'allow');
  }
  for (let index = 91; index <= 120; index += 1) {
    const result = await (index % 2 ? first : second).check({ request, requestId: `req-${index}`, kind: 'general' });
    assert.equal(result.decision.action, 'delay');
  }
  await assert.rejects(
    () => second.check({ request, requestId: 'req-121', kind: 'general' }),
    (error) => error instanceof RateLimitError && error.headers['Retry-After'] === '30',
  );
});

test('database decisions preserve configured limits and window reset metadata', () => {
  const now = new Date('2026-07-18T12:00:00.000Z');
  assert.deepEqual(mapDatabaseDecision({
    action: 'allow', count: 5, limit: 240, window_seconds: 120,
  }, 'general', now), {
    action: 'allow', count: 5, limit: 240, delayMs: undefined,
    retryAfterSeconds: null, resetAt: '2026-07-18T12:02:00.000Z',
  });
});

test('default request-control entry points fail closed when the server HMAC key is absent', async () => {
  const previous = process.env.SECURITY_HMAC_KEY;
  delete process.env.SECURITY_HMAC_KEY;
  try {
    await assert.rejects(
      () => enforceGeneralLimit({ request, requestId: 'req-general-default' }),
      /SECURITY_HMAC_KEY is required/,
    );
    await assert.rejects(
      () => enforceSensitiveLimit({ request, requestId: 'req-sensitive-default' }),
      /SECURITY_HMAC_KEY is required/,
    );
  } finally {
    if (previous === undefined) delete process.env.SECURITY_HMAC_KEY;
    else process.env.SECURITY_HMAC_KEY = previous;
  }
});
