import assert from "node:assert/strict";
import test from "node:test";

import {
  loginInputSchema,
  profileCompletionSchema,
  registrationInputSchema,
} from "./auth-input.ts";

test("registration normalizes email and enforces a strong bounded password", () => {
  const value = registrationInputSchema.parse({
    email: " USER@Example.COM ", password: "Correct-Horse-7!", passwordConfirmation: "Correct-Horse-7!",
    termsAccepted: true, privacyAccepted: true,
  });
  assert.equal(value.email, "user@example.com");
  assert.throws(() => registrationInputSchema.parse({
    email: "user@example.com", password: "short", passwordConfirmation: "short",
    termsAccepted: true, privacyAccepted: true,
  }));
  assert.throws(() => registrationInputSchema.parse({
    email: "user@example.com", password: "Correct-Horse-7!", passwordConfirmation: "different",
    termsAccepted: true, privacyAccepted: true,
  }));
});

test("login accepts email only and rejects oversized inputs", () => {
  assert.equal(loginInputSchema.parse({ email: "A@EXAMPLE.COM", password: "x" }).email, "a@example.com");
  assert.throws(() => loginInputSchema.parse({ email: "not-email", password: "x" }));
  assert.throws(() => loginInputSchema.parse({ email: "a@example.com", password: "x".repeat(257) }));
});

test("profile completion supports every age and derives guardian requirement server-side", () => {
  assert.equal(profileCompletionSchema.parse({
    displayName: "사용자", birthDate: "2020-07-19", termsVersion: "2026-07", privacyVersion: "2026-07",
  }).birthDate, "2020-07-19");
  assert.throws(() => profileCompletionSchema.parse({
    displayName: " ", birthDate: "not-a-date", termsVersion: "2026-07", privacyVersion: "2026-07",
  }));
});
