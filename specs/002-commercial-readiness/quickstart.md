# Quickstart Validation: Commercial Readiness Foundation

## Prerequisites

1. Node.js 22 and existing project dependencies.
2. A disposable Supabase project or local Supabase stack with the approved migration applied.
3. Separate test users for adult, child, room owner, manager, member, viewer, super admin, operations admin, support admin, and auditor.
4. Test configuration for Google, Kakao, and Naver custom providers, or explicit disabled-provider verification.
5. Guardian verification test adapter enabled only outside production.
6. Server encryption and HMAC keys supplied through test environment variables.

Never use production personal data, OAuth secrets, service-role keys, or guardian evidence in fixtures or captured output.

## Local quality commands

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits zero. Coverage output for changed domain and server modules reports at least 80% lines and functions.

## Scenario 1: Account states and recovery

1. Register an adult through email and confirm the email.
2. Complete profile and required consent.
3. Verify the account becomes active and can enter the dashboard.
4. Register a child and complete profile.
5. Verify the child remains guardian-pending and cannot access rooms or schedules.
6. Complete consent through the guardian test adapter and verify activation.
7. Start recovery for a known and unknown email and compare public responses.
8. Complete known-account recovery and verify all previous sessions fail.

Expected: public responses do not enumerate accounts; account-state gates match the specification.

## Scenario 2: Custom social providers and explicit linking

1. With each provider disabled, verify the login page presents a safe unavailable state.
2. Enable one staging provider and create a new social identity without provider email linking.
3. Verify profile completion requires a separately verified service email.
4. Create an existing email account, then sign in separately through a provider identity that reports the same email.
5. Verify the identities do not merge.
6. Sign in to the existing account, reauthenticate, and run the explicit link flow.
7. Verify the identity appears only after link completion and the audit event excludes provider tokens.

Expected: no automatic merge path exists and provider activation status is reported honestly.

## Scenario 3: Invitation lifecycle and concurrency

1. As an owner, create a one-use member invitation with a near-future expiry.
2. Open the invitation without authentication and inspect the preview payload.
3. Launch 1,000 concurrent redemption attempts against a seeded final-use invitation in the disposable environment.
4. Verify only one new membership and one use increment.
5. Reuse the token as the winning member and verify idempotent success without an increment.
6. Revoke and replace a separate invitation.
7. Verify the old token is denied immediately and the new raw token is shown once.

Expected: protected room content is absent from previews and maximum use is never exceeded.

## Scenario 4: Support and administration permissions

1. Submit a general inquiry as an active user and an appeal inquiry as a suspended user.
2. Attempt a general inquiry as the suspended user and verify denial.
3. Attempt to read each inquiry from another user and from operations/auditor accounts.
4. Claim and answer the inquiry as support admin.
5. Verify the user notification, immutable reply history, and audit access event.
6. Apply and release a user and room sanction as operations admin.
7. Attempt role assignment as operations admin and verify denial.
8. Assign and revoke a role as recently reauthenticated super admin.
9. Verify the last active super admin cannot be removed.

Expected: every role matches the capability matrix and schedule content is not exposed through admin metadata pages.

## Scenario 5: Request controls

1. Send 90 general requests within one fixed 60-second window and record no policy delay.
2. Send requests 91 through 120 and verify each policy delay is between one and three seconds.
3. Send request 121 and verify status 429 with retry guidance.
4. Repeat hard excess three times in ten minutes and verify a 15-minute block.
5. Verify automatic expiry and a separate authorized manual release both create events.
6. Send 21 login attempts for one IP and 21 attempts for one pseudonymized account across multiple IPs.
7. Verify either limit rejects login without account enumeration.
8. Forge forwarding headers outside the configured trusted proxy and verify they do not change the subject key.

Expected: all instances return consistent decisions and durable logs contain only pseudonyms.

## Scenario 6: Privacy, encryption, deletion, and restore

1. Write phone and birth date through the profile endpoint.
2. Inspect application tables and confirm no plaintext private value.
3. Read the profile through an authorized flow and verify a privacy-access event.
4. Change the active encryption key version and verify old data remains readable.
5. Re-encrypt one old record and verify the new version and unchanged plaintext result.
6. Request withdrawal and verify immediate session and product-access revocation.
7. Advance the disposable clock beyond seven days and run deletion.
8. Restore a pre-deletion backup into an isolated environment and replay deletion records.
9. Confirm deleted data does not become active.

Expected: ciphertext tampering fails authentication, logs contain no plaintext, and deletion survives restoration.

## Scenario 7: Accessibility and browser verification

For current Chrome, Edge, Safari, and Samsung Internet where devices are available:

1. Complete registration, login, invitation redemption, inquiry submission, and logout at 360-pixel width.
2. Complete user, room, inquiry, sanction, audit, and IP-block tasks at 1280-pixel width.
3. Repeat core flows with keyboard-only navigation.
4. Check focus visibility, labels, error associations, live status messages, and contrast.
5. Record browser version, device, direct result, screenshots for failures, and any reasoned-only compatibility.

Expected: directly executed targets have no blocking error; unexecuted targets are labeled unverified.

## Scenario 8: Backup and incident rehearsal

1. Restore the latest daily backup in an isolated environment.
2. Apply deletion reconciliation and verify protected counts.
3. Measure backup age and total restoration time.
4. Simulate an authentication-failure spike and critical job failure.
5. Verify alert routing, containment instructions, recovery checklist, and post-incident record.

Expected: RPO is no more than 24 hours, RTO no more than four hours, and every gap has an owner and remediation entry.

