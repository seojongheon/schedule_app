import assert from "node:assert/strict";
import test from "node:test";

import { RateLimitError } from "./rate-limit-service.ts";
import { withGeneralRateLimit, withRateLimit, withSensitiveRateLimit } from "./with-rate-limit.ts";

test("wrapper checks before the handler and attaches decision headers", async () => {
  const order = [];
  const wrapped = withRateLimit(async () => { order.push("handler"); return new Response("ok"); }, {
    kind: "general",
    requestId: () => "req-1",
    check: async () => { order.push("check"); return { headers: { "RateLimit-Limit": "120" } }; },
  });
  const response = await wrapped(new Request("https://service.example/api"));
  assert.deepEqual(order, ["check", "handler"]); assert.equal(response.headers.get("RateLimit-Limit"), "120");
});

test("typed rate errors become stable 429 responses", async () => {
  const wrapped = withRateLimit(async () => new Response("should not run"), {
    kind: "general", requestId: () => "req-2",
    check: async () => { throw new RateLimitError({ "Retry-After": "60", "RateLimit-Limit": "120" }, "reject"); },
  });
  const response = await wrapped(new Request("https://service.example/api"));
  assert.equal(response.status, 429); assert.equal(response.headers.get("Retry-After"), "60");
  assert.deepEqual(await response.json(), { error: { code: "rate_limit_exceeded", message: "요청이 너무 많습니다.", requestId: "req-2" } });
});

test("default general and sensitive wrappers fail closed without a server HMAC key", async () => {
  const previous = process.env.SECURITY_HMAC_KEY;
  delete process.env.SECURITY_HMAC_KEY;
  try {
    const handler = async () => Response.json({ ok: true });
    await assert.rejects(() => withGeneralRateLimit(handler)(new Request("https://service.example/api")), /SECURITY_HMAC_KEY/);
    await assert.rejects(() => withSensitiveRateLimit(handler)(new Request("https://service.example/api")), /SECURITY_HMAC_KEY/);
  } finally {
    if (previous === undefined) delete process.env.SECURITY_HMAC_KEY;
    else process.env.SECURITY_HMAC_KEY = previous;
  }
});
