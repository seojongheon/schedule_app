# Tasks: Commercial Readiness Foundation

**Input**: Design documents from `/specs/002-commercial-readiness/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Every behavioral implementation task follows red-green-refactor. A focused test task must fail for the expected missing behavior before production code is added.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files and no dependency on another incomplete task in the same phase
- **[Story]**: User story mapping from spec.md

## Phase 1: Setup and Verification Baseline

**Purpose**: Establish repeatable test, coverage, and environment contracts without changing product behavior.

- [x] T001 Add full-domain test and coverage scripts while preserving existing unit tests in package.json
- [x] T002 [P] Document required custom OAuth, encryption, HMAC, trusted-proxy, and guardian adapter variables in .env.example
- [x] T003 [P] Create shared test fixtures for requests, clocks, identities, and repositories in src/test/security-fixtures.mjs
- [x] T004 Run npm run test:unit, npm run typecheck, npm run lint, and npm run build and record the baseline in specs/002-commercial-readiness/validation.md

**Checkpoint**: Existing behavior has a reproducible green baseline or a documented pre-existing blocker.

---

## Phase 2: Foundational Security and Privacy Units

**Purpose**: Pure policies and infrastructure contracts used by every user story.

**CRITICAL**: No user story route is exposed before these units and the approved schema migration exist.

- [x] T005 [P] Write failing account-state and session-age tests in src/domain/auth/account-policy.test.mjs
- [x] T006 Implement account-state, route access, inactivity, absolute-age, and recent-reauthentication rules in src/domain/auth/account-policy.ts
- [x] T007 [P] Write failing room and service capability matrix tests in src/domain/authorization/capabilities.test.mjs
- [x] T008 Implement room and service capability resolution in src/domain/authorization/capabilities.ts
- [x] T009 [P] Write failing authenticated-encryption, HMAC, tamper, and key-version tests in src/lib/privacy/encryption.test.mjs
- [x] T010 Implement the AES-256-GCM envelope and exact-match HMAC helpers in src/lib/privacy/encryption.ts
- [x] T011 [P] Write failing audit allowlist and redaction tests in src/lib/audit/audit-event.test.mjs
- [x] T012 Implement controlled audit event construction and metadata redaction in src/lib/audit/audit-event.ts
- [x] T013 [P] Write failing general and sensitive request-policy tests in src/domain/rate-limit/policy.test.mjs
- [x] T014 Implement allow, delay, reject, repeated-excess, block, and expiry decisions in src/domain/rate-limit/policy.ts
- [x] T015 Create the explicitly approved additive schema, migration, RLS policies, transactional invitation, audit, sanction, and request-control functions in supabase/migrations/20260718120000_commercial_readiness_foundation.sql
- [x] T016 [P] Create SQL assertions for RLS isolation, append-only audit, invitation concurrency, and request-control atomicity in supabase/tests/commercial_readiness_security.sql
- [x] T017 Regenerate and reconcile application schema types in src/data/database.types.ts
- [x] T018 Implement service repositories for profiles, roles, audit, and request-control storage in src/data/repositories/security-repository.ts
- [x] T019 Add server-only security configuration, request-ID, same-origin, and CSRF guard parsing with fail-closed production validation in src/lib/security-config.ts and src/lib/request-security.ts

**Checkpoint**: Shared policies pass, new tables are protected, and no route depends on client-provided roles or plaintext private fields.

---

## Phase 3: User Story 1 - Create and Recover a Secure Account (Priority: P1)

**Goal**: Public email and three custom social provider flows with safe state gates, recovery, explicit linking, and legal-guardian consent.

**Independent Test**: Execute spec User Story 1 scenarios with fake provider and guardian adapters and verify provider-disabled production behavior.

- [ ] T020 [P] [US1] Write failing registration, login, recovery, provider, callback, profile, and reauthentication schema tests in src/domain/auth/auth-input.test.mjs
- [ ] T021 [P] [US1] Write failing custom-provider registry and no-email-link tests in src/lib/auth/provider-registry.test.mjs
- [ ] T022 [US1] Implement validated Google, Kakao, and Naver custom-provider registry and safe disabled states in src/lib/auth/provider-registry.ts
- [ ] T023 [P] [US1] Write failing guardian provider contract and state-transition tests in src/lib/auth/guardian-verification.test.mjs
- [ ] T024 [US1] Implement disabled production and deterministic test guardian adapters in src/lib/auth/guardian-verification.ts
- [ ] T025 [US1] Move password sign-in behind rate-controlled POST handling in src/app/api/auth/login/route.ts and update src/components/app/LoginForm.tsx
- [ ] T026 [US1] Implement enumeration-safe registration, recovery, and password-change routes in src/app/api/auth/register/route.ts, src/app/api/auth/recovery/route.ts, and src/app/api/auth/password/route.ts
- [ ] T027 [US1] Implement custom-provider start, callback, and explicit-link flows in src/app/api/auth/provider/[provider]/start/route.ts, src/app/auth/callback/route.ts, and src/app/api/auth/identities/[provider]/link/route.ts
- [ ] T028 [US1] Implement encrypted profile completion and guardian verification routes in src/app/api/auth/profile/route.ts and src/app/api/auth/guardian/verification/route.ts
- [ ] T029 [US1] Implement signup, profile completion, recovery, and provider-state UI in src/app/signup/page.tsx, src/app/auth/complete-profile/page.tsx, src/app/recovery/page.tsx, and src/components/auth/AuthForms.tsx
- [ ] T030 [US1] Replace demo fallback in src/lib/auth.ts and add authoritative account-state guards in src/lib/auth/account-access.ts and src/middleware.ts
- [ ] T031 [US1] Run focused User Story 1 tests and record live-provider items as verified, disabled, or unverified in specs/002-commercial-readiness/validation.md

**Checkpoint**: Enabled public account flows work, inactive states fail closed, and no provider email triggers automatic merging.

---

## Phase 4: User Story 2 - Join a Room Through a Controlled Invitation (Priority: P1)

**Goal**: Hashed, expiring, revocable, limited-use invitations with safe previews and atomic redemption.

**Independent Test**: Create, preview, redeem, concurrently exhaust, revoke, and replace invitations while checking member/viewer grants.

- [ ] T032 [P] [US2] Write failing token, preview, status, role-grant, and idempotency tests in src/domain/invites/invite-policy.test.mjs
- [ ] T033 [US2] Implement opaque-token generation, hashing, preview projection, and result mapping in src/domain/invites/invite-policy.ts
- [ ] T034 [P] [US2] Write failing invitation repository and route contract tests in src/data/repositories/invite-repository.test.mjs
- [ ] T035 [US2] Implement invitation repository calls to transactional functions in src/data/repositories/invite-repository.ts
- [ ] T036 [US2] Implement create, preview, redeem, revoke, and replace endpoints in src/app/api/rooms/[roomId]/invites/route.ts and src/app/api/invites/[token]/route.ts
- [ ] T037 [US2] Implement invite-preview and join UI plus room invitation controls in src/app/join/[token]/page.tsx and src/components/app/RoomInvitePanel.tsx
- [ ] T038 [US2] Update room/member domain types and schedule presentation for viewer access in src/domain/entities.ts and src/components/app/ScheduleWorkspace.tsx
- [ ] T039 [US2] Run invitation unit, contract, SQL concurrency, and safe-preview checks and record results in specs/002-commercial-readiness/validation.md

**Checkpoint**: Invitation maximum uses cannot be exceeded and leaked links cannot reveal protected content or grant elevated roles.

---

## Phase 5: User Story 3 - Request and Receive Private Support (Priority: P2)

**Goal**: Private, stateful inquiry and reply handling with limited-account access, assignment, notification, and access history.

**Independent Test**: Submit, claim, read, reply, answer, and close inquiries across allowed and denied user and service roles.

- [ ] T040 [P] [US3] Write failing inquiry transition and category-by-account-state tests in src/domain/support/inquiry-policy.test.mjs
- [ ] T041 [US3] Implement inquiry status, category, actor, and transition policy in src/domain/support/inquiry-policy.ts
- [ ] T042 [P] [US3] Write failing inquiry encryption, ownership, assignment, and first-read audit repository tests in src/data/repositories/inquiry-repository.test.mjs
- [ ] T043 [US3] Implement encrypted inquiry and notification repository in src/data/repositories/inquiry-repository.ts
- [ ] T044 [US3] Implement user and staff inquiry routes in src/app/api/inquiries/route.ts and src/app/api/inquiries/[inquiryId]/route.ts
- [ ] T045 [US3] Implement inquiry list, detail, composition, reply, and status UI in src/app/support/page.tsx, src/app/support/[inquiryId]/page.tsx, and src/components/support/InquiryWorkspace.tsx
- [ ] T046 [US3] Run focused inquiry privacy and state tests and record results in specs/002-commercial-readiness/validation.md

**Checkpoint**: Users can resolve support needs without cross-user disclosure, and staff content access is scoped and audited.

---

## Phase 6: User Story 4 - Operate Users and Rooms with Scoped Administration (Priority: P2)

**Goal**: PC-first administration for users, rooms, reports, sanctions, inquiries, audit, and IP blocks with four service roles.

**Independent Test**: Exercise the full capability matrix and verify masked, denied, and mutable operations per role.

- [ ] T047 [P] [US4] Write failing administrator route authorization, masking, sanction, and last-super-admin tests in src/domain/authorization/admin-policy.test.mjs
- [ ] T048 [US4] Implement administrator query scopes, masking, sanctions, and role mutation use cases in src/domain/authorization/admin-policy.ts
- [ ] T049 [P] [US4] Write failing sanction and role repository transaction tests in src/data/repositories/admin-repository.test.mjs
- [ ] T050 [US4] Implement scoped users, rooms, reports, sanctions, roles, inquiries, audit, and IP-block repositories in src/data/repositories/admin-repository.ts
- [ ] T051 [US4] Replace boolean-admin endpoints, add user report submission under src/app/api/reports, and add users, rooms, reports, sanctions, roles, inquiries, audit, and IP-block role-scoped routes under src/app/api/admin while retaining a controlled initial-super-admin compatibility path
- [ ] T052 [US4] Build PC-first administration navigation and users, rooms, reports, inquiries, sanctions, audit, and IP-block views in src/app/admin/page.tsx and src/components/admin/AdminWorkspace.tsx
- [ ] T053 [US4] Run each role against every administrator route and record matrix results in specs/002-commercial-readiness/validation.md

**Checkpoint**: No service role grants room content implicitly, and every mutation is reasoned, recent-reauthenticated where required, and audited.

---

## Phase 7: User Story 5 - Resist Abusive and Abnormal Requests (Priority: P2)

**Goal**: Trusted-IP resolution and shared general, sensitive, account, repeated-excess, block, and release behavior.

**Independent Test**: Drive exact boundary counts across multiple store clients and verify the configured forwarding trust model.

- [ ] T054 [P] [US5] Write failing trusted-proxy and malformed-forwarding tests in src/lib/rate-limit/client-ip.test.mjs
- [ ] T055 [US5] Implement deployment-specific trusted client IP resolution in src/lib/rate-limit/client-ip.ts
- [ ] T056 [P] [US5] Write failing shared-store adapter and response-header tests in src/lib/rate-limit/rate-limit-service.test.mjs
- [ ] T057 [US5] Implement transactional store calls, deterministic injectable delay, headers, and request wrapper in src/lib/rate-limit/rate-limit-service.ts
- [ ] T058 [US5] Apply general policy to application API routes and sensitive policy to login, recovery, password, and invitation validation through src/lib/rate-limit/with-rate-limit.ts
- [ ] T059 [US5] Implement authorized manual IP release and automatic expiry reporting in src/app/api/admin/ip-blocks/[blockId]/release/route.ts
- [ ] T060 [US5] Run exact 90, 120, 121, repeated-excess, account-limit, forged-header, and cross-instance tests and record results in specs/002-commercial-readiness/validation.md

**Checkpoint**: Request controls match every specified threshold and do not rely on process-local memory or untrusted headers.

---

## Phase 8: User Story 6 - Exercise Privacy Rights and Recover Operations (Priority: P3)

**Goal**: Personal-data access, correction, withdrawal, deletion, key rotation, restore reconciliation, and operational evidence.

**Independent Test**: Encrypt, access, rotate, withdraw, delete, restore, reconcile, and confirm no plaintext or expired data returns.

- [ ] T061 [P] [US6] Write failing privacy access, withdrawal, deletion eligibility, and restore reconciliation tests in src/domain/privacy/privacy-lifecycle.test.mjs
- [ ] T062 [US6] Implement privacy lifecycle and deletion plan generation in src/domain/privacy/privacy-lifecycle.ts
- [ ] T063 [P] [US6] Write failing encrypted private-profile repository and key-rotation tests in src/data/repositories/privacy-repository.test.mjs
- [ ] T064 [US6] Implement authorized decrypt, correction, withdrawal, export, re-encryption, and deletion repository operations in src/data/repositories/privacy-repository.ts
- [ ] T065 [US6] Implement privacy export, profile correction, withdrawal, and cancellation routes under src/app/api/privacy
- [ ] T066 [US6] Implement idempotent deletion, retention cleanup, and re-encryption job entry points in scripts/run-privacy-maintenance.mjs
- [ ] T067 [P] [US6] Implement redacted monitoring and alert event adapters in src/lib/operations/monitoring.ts and write neutral runbooks in docs/operations/auth-providers.md, docs/operations/privacy-retention.md, docs/operations/incident-response.md, and docs/operations/backup-restore.md
- [ ] T068 [US6] Run encryption tamper, access audit, rotation, deletion, and isolated restore-reconciliation checks and record results in specs/002-commercial-readiness/validation.md

**Checkpoint**: Privacy rights and recovery are executable, auditable, and fail closed without plaintext leakage.

---

## Phase 9: Polish and Cross-Cutting Verification

**Purpose**: Verify integrated behavior, accessibility, compatibility, and release evidence.

- [ ] T069 [P] Add keyboard, focus, label, live-status, error-association, and contrast improvements across src/components/auth, src/components/support, and src/components/admin
- [ ] T070 Add navigation entries and limited-account recovery paths in src/components/app/AppFrame.tsx and src/components/app/BottomNavigation.tsx
- [ ] T071 Run npm run test:unit with coverage and add focused tests until changed line and function coverage reach 80% in affected modules
- [ ] T072 Run npm run typecheck, npm run lint, and npm run build and resolve all failures without weakening tests
- [ ] T073 Execute configured direct-browser scenarios from specs/002-commercial-readiness/quickstart.md and record browser/version evidence in specs/002-commercial-readiness/validation.md
- [ ] T074 Execute or explicitly mark unverified the live Google, Kakao, Naver, guardian, invitation and schedule concurrency, backup restore, and alert-delivery scenarios in specs/002-commercial-readiness/validation.md
- [ ] T075 Reconcile every FR-001 through FR-062 and SC-001 through SC-012 against completed tasks and evidence in specs/002-commercial-readiness/validation.md

---

## Dependencies and Execution Order

### Phase dependencies

- Phase 1 has no feature dependency.
- Phase 2 depends on Phase 1 and blocks every story.
- User Story 1 and User Story 2 are P1 and execute after Phase 2.
- User Stories 3, 4, and 5 are P2 and depend on the shared foundation; administration also consumes inquiry and request-control data.
- User Story 6 depends on the shared encryption and audit foundation and is completed before final verification.
- Phase 9 depends on all included stories.

### User story dependencies

- **US1**: Shared foundation only.
- **US2**: Shared foundation and active-account resolver from US1.
- **US3**: Shared foundation and limited-account resolver from US1.
- **US4**: Shared foundation; integrates US3 inquiry views and US5 IP block views after their repositories exist.
- **US5**: Shared foundation; login integration consumes US1 route.
- **US6**: Shared foundation and account-state resolver from US1.

### Parallel opportunities

- Pure policy test/implementation pairs for auth, authorization, encryption, audit, and request decisions touch separate files.
- UI work starts only after corresponding routes and repositories are green.
- Operations runbooks can be written while privacy repository tests are implemented.
- Direct live-provider and browser verification remains sequential because it shares environment configuration.

## Implementation Strategy

1. Complete setup and the shared foundation with explicit migration approval.
2. Deliver P1 account and invitation stories and verify them independently.
3. Deliver inquiry, administration, and request control as separate P2 increments.
4. Deliver privacy lifecycle and recovery as the P3 operational increment.
5. Run full coverage, build, browser, external-provider, restore, and requirement reconciliation.

## Notes

- Never mark an external provider, browser, backup restore, or alert path as verified without direct evidence.
- Never store raw OAuth tokens, invitation tokens, passwords, private fields, or inquiry bodies in logs or fixtures.
- Preserve the user's existing `.gitignore` change and unrelated working-tree content.
- Migration T015 requires explicit user approval under project rules before the file is created.
