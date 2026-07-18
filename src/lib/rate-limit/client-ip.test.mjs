import assert from "node:assert/strict";
import test from "node:test";

import { resolveClientIp } from "./client-ip.ts";

test("direct mode uses only the server-supplied direct address", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.10" });
  assert.equal(resolveClientIp({ headers, trustedProxyMode: "none", directIp: "192.0.2.4" }), "192.0.2.4");
  assert.throws(() => resolveClientIp({ headers, trustedProxyMode: "none", production: true }), /trusted client IP/i);
});

test("Vercel mode trusts only the first platform forwarding address", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "cf-connecting-ip": "198.51.100.2" });
  assert.equal(resolveClientIp({ headers, trustedProxyMode: "vercel", production: true }), "203.0.113.7");
});

test("Cloudflare mode trusts only cf-connecting-ip", () => {
  const headers = new Headers({ "cf-connecting-ip": "2001:db8::1", "x-forwarded-for": "203.0.113.7" });
  assert.equal(resolveClientIp({ headers, trustedProxyMode: "cloudflare", production: true }), "2001:db8::1");
});

test("malformed, host-port, and unexpected forwarded values fail closed", () => {
  for (const value of ["unknown", "203.0.113.1:443", "", "999.1.1.1"]) {
    assert.throws(() => resolveClientIp({ headers: new Headers({ "x-forwarded-for": value }), trustedProxyMode: "vercel", production: true }), /trusted client IP/i, value);
  }
  assert.equal(resolveClientIp({ headers: new Headers({ "x-forwarded-for": "203.0.113.1, untrusted-value" }), trustedProxyMode: "vercel", production: true }), "203.0.113.1");
});

test("development without a direct address uses loopback only", () => {
  assert.equal(resolveClientIp({ headers: new Headers(), trustedProxyMode: "none", production: false }), "127.0.0.1");
});
