import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderRegistry,
  requireExplicitIdentityLink,
} from "./provider-registry.ts";

test("Google, Kakao, and Naver are custom email-optional providers", () => {
  const registry = createProviderRegistry({
    google: { enabled: true, provider: "custom:google" },
    kakao: { enabled: true, provider: "custom:kakao" },
    naver: { enabled: true, provider: "custom:naver" },
  });
  assert.deepEqual(Object.keys(registry), ["google", "kakao", "naver"]);
  for (const provider of Object.values(registry)) {
    assert.equal(provider.emailOptional, true);
    assert.match(provider.supabaseProvider, /^custom:/);
  }
});

test("disabled or malformed providers fail safely", () => {
  const registry = createProviderRegistry({
    google: { enabled: false, provider: "custom:google" },
    kakao: { enabled: true, provider: "kakao" },
    naver: { enabled: false, provider: "custom:naver" },
  });
  assert.equal(registry.google.enabled, false);
  assert.equal(registry.kakao.enabled, false);
  assert.equal(registry.kakao.disabledReason, "invalid_custom_provider");
});

test("identity linking never treats matching email as ownership proof", () => {
  assert.deepEqual(requireExplicitIdentityLink({ mode: "signin", authenticatedUserId: "user-1", recentlyAuthenticated: true }), { allowed: true, mode: "signin" });
  assert.deepEqual(requireExplicitIdentityLink({ mode: "link", authenticatedUserId: "user-1", recentlyAuthenticated: true }), { allowed: true, mode: "link", userId: "user-1" });
  assert.deepEqual(requireExplicitIdentityLink({ mode: "link", authenticatedUserId: "user-1", recentlyAuthenticated: false }), { allowed: false, reason: "recent_authentication_required" });
  assert.deepEqual(requireExplicitIdentityLink({ mode: "link", authenticatedUserId: null, recentlyAuthenticated: true }), { allowed: false, reason: "authentication_required" });
});
