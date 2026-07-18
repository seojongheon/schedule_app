# Validation: Commercial Readiness Foundation

## Baseline — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Existing unit tests | PASS | `npm run test:unit`: 8 passed, 0 failed |
| TypeScript | PASS | `npm run typecheck`: exit 0 |
| ESLint | PASS after worktree configuration fix | `npm run lint`: exit 0 after setting the worktree config as an ESLint root |
| Production build | PASS with warnings | `npm run build`: exit 0; existing Supabase Edge Runtime and nested lockfile warnings recorded |

### Baseline environment note

The project-local worktree is nested beneath the primary checkout. Without `root: true`, ESLint cascaded into the parent checkout configuration and loaded two physical copies of `@next/next`. The isolated branch now terminates ESLint configuration lookup at its own `.eslintrc.json`. No product behavior changed.

## Foundational policy units — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Red phase | PASS | `npm run test:security` failed for the five intentionally absent policy modules before implementation |
| Account and session policy | PASS | Active-only product access, limited recovery areas, 7-day inactivity, 30-day absolute age, and 10-minute reauthentication boundaries |
| Room and service authorization | PASS | Exact approved room and service capability matrices; service roles do not imply room access |
| Private-value protection | PASS | AES-256-GCM round trip, fresh 96-bit IV, 128-bit tag, AAD binding, tamper rejection, key versions, and normalized HMAC |
| Audit safety | PASS | Controlled event shape, metadata allowlist, sensitive-field exclusion, and bounded primitive metadata |
| Request policy | PASS | General 90/120 thresholds, 1–3 second delay band, sensitive 20/5-minute limit, third excess block, and block expiry |
| Focused security suite | PASS | `npm run test:security`: 27 passed, 0 failed |
| TypeScript and ESLint | PASS | `npm run typecheck` and `npm run lint`: exit 0 |

## Database and server security foundation — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Additive migration artifact | CREATED, UNAPPLIED | Adds account lifecycle, private envelopes, guardian consent, role assignments, secure invitations, inquiries, reports, sanctions, audit, request control, IP blocks, deletion markers, RLS, and protected functions |
| SQL security assertions | CREATED, UNEXECUTED | Catalog assertions cover RLS, append-only audit, protected RPC grants, invitation row locking/idempotency, and atomic rate counter structure |
| Application schema types | PASS | `src/data/database.types.ts` reconciled with the additive schema; `npm run typecheck`: exit 0 |
| Security repository | PASS | Lifecycle-only profile reads, active role filtering, protected audit RPC, protected rate RPC, and error propagation tests |
| Server security configuration | PASS | Production key requirements, provider activation, guardian mode, and trusted proxy validation tests |
| Request guards | PASS | Request ID validation, exact-origin enforcement, and CSRF double-submit tests |
| Focused security suite | PASS | `npm run test:security`: 39 passed, 0 failed |

The migration and SQL assertions have deliberately not been run against the linked remote project. They require a disposable database and remain `UNVERIFIED` until that evidence exists.

## User Story 1 — secure account access — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Authentication input and account policy | PASS | Email normalization, password bounds, profile input, account-state, session-age, and recent-authentication tests |
| Google, Kakao, Naver registry | PASS (unit), UNVERIFIED (live) | All three require `custom:*`, are email-optional, and malformed/disabled configuration fails safely |
| Explicit identity linking | PASS (unit), UNVERIFIED (live) | Link mode requires an authenticated user and recent authentication; provider email is never accepted as ownership evidence |
| Guardian verification | PASS (unit), DISABLED (production) | Disabled adapter fails closed; deterministic adapter is test-only and forbidden in production |
| Email registration and recovery | PASS (build), UNVERIFIED (delivery) | Enumeration-safe routes and UI compile; outbound delivery requires hosted Auth configuration |
| Password login | PASS (build), UNVERIFIED (hosted DB) | Server-only password verification, IP/account throttling, generic denials, session timestamps, and required audit persistence compile |
| Profile completion | PASS (build), UNVERIFIED (hosted DB) | Private birth date and optional phone are encrypted before a transactional completion RPC; under-14 accounts remain guardian-pending |
| Demo bypass removal | PASS | Protected pages no longer fall back to a mock user; middleware and server access checks fail closed |
| Full unit suite | PASS | `npm run test:unit`: 53 passed, 0 failed |
| Production build | PASS with recorded warnings | `npm run build`: exit 0; nested-lockfile warning remains an isolated-worktree artifact |

## User Story 2 — controlled invitations — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Opaque token policy | PASS | 256-bit URL-safe tokens, SHA-256 storage hashes, non-secret hints, safe preview projection, stable denial mapping, and existing-member idempotency tests |
| Legacy invitation invalidation | PASS (artifact) | Legacy plaintext codes are overwritten; rows without secure hashes receive random hashes and are revoked and deactivated |
| Repository and route contracts | PASS | Create, preview, redeem, revoke, and replace use hash-only RPC contracts and nested endpoints; secrets are returned only at creation or replacement |
| Server-only mutation boundary | PASS (static), UNVERIFIED (live DB) | Mutation RPCs require `service_role`, receive a server-derived actor, revalidate active account and room role in SQL, and cannot accept a client-supplied IP audit key directly |
| Transaction and denial behavior | PASS (static), UNVERIFIED (live DB) | Redeem and replace lock invitation rows; denials append attempt and audit records in the same function; repository denial handling is covered |
| UI and viewer role | PASS (build) | Join preview, member/viewer grants, room invitation controls, and viewer read-only presentation compile |
| Concurrency target | UNVERIFIED | No disposable PostgreSQL environment was available for the 1,000-trial final-use race test |

## User Story 3 — private support — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Inquiry policy | PASS | Account-state categories, ownership, support assignment, transitions, and closed-inquiry denial tests |
| Encrypted repository | PASS | Inquiry bodies and replies use AES-GCM envelopes; transaction RPC errors are propagated |
| Transactional lifecycle | PASS (static), UNVERIFIED (live DB) | Create, audited read, claim, reply, status change, and aging notification functions are present in the unapplied migration |
| Metadata isolation | PASS (static) | Source tables are not client-readable; the queue RPC is service-only and contains no subject or encrypted body fields |
| Routes and UI | PASS (build) | User list/detail/composition and support processing pages compile; operations and auditors receive metadata-only views |
| Notification delivery | UNVERIFIED | Queue generation is covered; external delivery and production scheduling are not configured |

## User Story 4 — scoped administration — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Capability matrix | PASS | Super, operations, support, and auditor actions, masking, and last-super-admin rules are unit-tested |
| Data access boundary | PASS (static) | Sensitive list data uses a service client only after authenticated route authorization; direct administrator table read policies are removed |
| Mutations and audit | PASS (static), UNVERIFIED (live DB) | Role, report, sanction, IP release, request-policy, and read-audit RPC contracts are present |
| Inquiry administration | PASS (build/static) | Support can claim and process content; operations and auditors receive the approved metadata projection |
| PC-first workspace | PASS (build), PARTIAL (browser) | Users, rooms, reports, sanctions, inquiries, audit, roles, IP blocks, and request policies are reachable; unauthenticated 1280-pixel access redirects safely |
| Full live role matrix | UNVERIFIED | No hosted database administrator fixtures were used |

## User Story 5 — request controls — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Trusted client IP | PASS | Direct, Vercel, Cloudflare, malformed, host-port, and forged forwarding inputs are covered |
| General thresholds | PASS | Counts 1–90 allow, 91–120 delay one to three seconds, and 121 rejects with retry guidance |
| Repeated excess and block | PASS | Third hard excess in ten minutes creates a 15-minute block; active and expired block behavior is covered |
| Sensitive and login keys | PASS | Twenty attempts per five minutes and independent IP/account login decisions are covered |
| Shared decision store | PASS (unit), UNVERIFIED (hosted DB) | Separate service instances share a fake transactional store; production database RPC execution remains unverified |
| Operations review | PASS (build/static) | Manual release, automatic expiry, event history, configurable defaults, revision reason, and audit contracts compile |

## User Story 6 — privacy and operations — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Private-data lifecycle | PASS | Authorized decrypt, correction, access audit, key rotation, withdrawal, cancellation, deletion eligibility, and restore reconciliation tests |
| Maintenance entry points | PASS (unit/build) | Idempotent deletion, retention cleanup, re-encryption, restore quarantine, and inquiry-aging scripts compile and have focused tests |
| Retention policy | PASS (unit/static) | Seven-day withdrawal, three-year inquiry, one-year audit/access, 90-day request events, and 35-day backup rotation are documented or tested |
| Monitoring and runbooks | PASS (unit/artifact) | Redacted monitoring plus neutral auth, privacy, incident, and backup/restore runbooks are present |
| Isolated restore and alert delivery | UNVERIFIED | No production-equivalent backup, restore, scheduler, or alert destination was available |

## Integrated verification — 2026-07-18

| Check | Result | Evidence |
|---|---|---|
| Security suite | PASS | `npm run test:security`: 155 passed, 0 failed |
| Coverage suite | PASS | `npm run test:coverage`: 154 passed; aggregate 96.94% lines and 95.90% functions |
| Affected module coverage | PASS | Admin repository 100% lines/functions, inquiry repository 94.19%/81.82%, invite repository 100%/100%, rate-limit service 86.30%/90.00% |
| TypeScript | PASS | `npm run typecheck`: exit 0 |
| ESLint | PASS | `npm run lint`: exit 0 |
| Production build | PASS with warning | `npm run build`: exit 0; Next.js reported the repository/worktree nested-lockfile root warning |
| Independent security review | PASS | No Critical or Important findings remain after recovery-session, service-only activity touch, atomic invite replacement, and transaction-scoped inquiry-role fixes |
| SQL migration | CREATED, UNAPPLIED | No migration was applied locally or remotely; catalog assertions and runtime behavior remain unexecuted |

## Direct browser evidence

| Scenario | Result | Evidence |
|---|---|---|
| 360-pixel public authentication | PASS | Login, signup, and password-change layouts showed no horizontal overflow in Codex In-app Browser |
| Login error accessibility | PASS | Invalid submit moved focus to email; fields exposed `aria-invalid` and `aria-describedby`; messages used `role=alert` |
| 1280-pixel unauthenticated administration | PASS | `/admin` redirected to `/login` with no horizontal overflow |
| Browser identity | LIMITED | The tool identified only as Codex In-app Browser; engine and version were not exposed |
| Authenticated journeys | UNVERIFIED | Hosted account, administrator, provider, inquiry, invitation, and database fixtures were not available |
| Named browser matrix | UNVERIFIED | Chrome, Edge, Safari, and Samsung Internet were not directly exercised |

## External and live verification status

| Area | Status | Notes |
|---|---|---|
| Google custom provider | UNVERIFIED | Credentials and hosted provider configuration are not present |
| Kakao custom provider | UNVERIFIED | Credentials and hosted provider configuration are not present |
| Naver custom provider | UNVERIFIED | Credentials and provider approval are external prerequisites |
| Email recovery delivery | UNVERIFIED | PKCE callback and session-revocation code compile and have contract tests; hosted email delivery was not exercised |
| Guardian identity provider | DISABLED | Production adapter remains fail-closed until a provider contract and credentials exist |
| Disposable SQL/RLS environment | UNVERIFIED | Migration, grants, RLS, SQL functions, and SQL assertions were not executed |
| Invitation concurrency | UNVERIFIED | Row-lock structure is present; the required 1,000-trial race test was not run |
| Schedule conflict concurrency | UNVERIFIED | No production-equivalent concurrent schedule fixture was run |
| Backup restore | UNVERIFIED | Runbook and reconciliation code exist; no isolated restore exercise was run |
| Monitoring alert delivery | UNVERIFIED | Redacted adapter tests pass; no external alert destination was exercised |

## Requirement traceability

| Requirements | Status | Evidence or remaining gap |
|---|---|---|
| FR-001, FR-006, FR-007, FR-008, FR-009, FR-010 | IMPLEMENTED, LIVE UNVERIFIED | Email account, PKCE recovery, state gates, enumeration safety, session age, and recent authentication code/tests |
| FR-002, FR-003, FR-004, FR-005 | IMPLEMENTED, PROVIDERS UNVERIFIED | Google/Kakao/Naver registry, unavailable state, explicit linking, and no email-based merge |
| FR-011, FR-012, FR-013 | IMPLEMENTED | All-age onboarding and guardian-pending product denial; minimum encrypted profile fields |
| FR-014, FR-015 | PARTIAL | Consent states and cleanup structures exist; live guardian expiry, withdrawal, and deletion workflow is unverified |
| FR-016, FR-017, FR-018, FR-019, FR-020 | IMPLEMENTED, SQL UNVERIFIED | Exact role matrices, route gates, RLS/RPC artifacts, and no service-role room implication |
| FR-021, FR-022 | IMPLEMENTED, SQL UNVERIFIED | Member-only room policies and allowlisted invite preview projection |
| FR-023, FR-024, FR-025, FR-027, FR-028 | IMPLEMENTED, SQL UNVERIFIED | Server-only hashed invite lifecycle, actor validation, row locking, denial/attempt/audit records |
| FR-026 | UNVERIFIED | Static transaction structure exists; live concurrent redemption was not run |
| FR-029, FR-030, FR-031, FR-032 | IMPLEMENTED, SQL/DELIVERY UNVERIFIED | Inquiry state, encrypted content access, staff assignment, and body-free notification queue |
| FR-033, FR-034, FR-035 | IMPLEMENTED, LIVE MATRIX UNVERIFIED | PC-first administration, reasoned restrictions/releases, and append-only audit contracts |
| FR-036 | IMPLEMENTED BY AUTH SERVICE, HOSTED UNVERIFIED | Application stores no passwords; password verification is delegated to hosted Auth |
| FR-037, FR-038, FR-039, FR-040, FR-041, FR-042 | IMPLEMENTED | AES-GCM envelopes, versioned server keys, rotation, redacted audit/logging, and transactional failure contracts |
| FR-043, FR-044, FR-045 | IMPLEMENTED, LIVE MAINTENANCE UNVERIFIED | Withdrawal, deletion/de-identification, retention policy, and idempotent jobs |
| FR-046, FR-047 | DOCUMENTED, EXERCISE UNVERIFIED | Backup rotation, restore reconciliation, incident, and deletion replay runbooks |
| FR-048, FR-049, FR-050, FR-051, FR-052, FR-053, FR-054, FR-055, FR-056 | IMPLEMENTED, HOSTED STORE UNVERIFIED | Exact request-control tests, trusted proxy parsing, review history, and configurable defaults |
| FR-057 | PARTIAL | Direct 360-pixel public and 1280-pixel unauthenticated admin evidence only |
| FR-058 | PARTIAL | Focus, label, error association, keyboard-oriented components, and limited direct checks; no full WCAG audit |
| FR-059 | UNVERIFIED | Named current-browser matrix was not run |
| FR-060 | IMPLEMENTED, DELIVERY UNVERIFIED | Redacted monitoring and critical-condition adapter tests; no external delivery evidence |
| FR-061 | DOCUMENTED, EXERCISE UNVERIFIED | Quarterly restore procedure exists; no exercise evidence |
| FR-062 | PASS FOR THIS CHANGESET | Security fixes and features were driven by failing focused tests before implementation |
| SC-001 | UNVERIFIED | No participant usability study or live provider journey |
| SC-002 | PARTIAL | Automated authorization tests pass; live RLS and full role matrix are unverified |
| SC-003 | PARTIAL | Policy tests pass; hosted guardian/account-state execution is unverified |
| SC-004 | UNVERIFIED | Required 1,000 concurrent final-use trials were not run |
| SC-005 | PARTIAL | Exact and cross-instance unit decisions pass; hosted shared-store execution is unverified |
| SC-006 | PARTIAL | Audit contracts and repository tests pass; live database audit completeness is unverified |
| SC-007 | PARTIAL | Withdrawal/deletion unit and job tests pass; production timing was not measured |
| SC-008 | UNVERIFIED | No quarterly restore exercise; RPO/RTO not measured |
| SC-009 | UNVERIFIED | No production-readiness load profile or p95 measurement |
| SC-010 | UNVERIFIED | No post-launch monthly availability data |
| SC-011 | PARTIAL | Limited direct accessibility evidence; no full automated/manual WCAG audit |
| SC-012 | PASS | Aggregate and affected modules exceed 80% line/function coverage; quality commands pass |
