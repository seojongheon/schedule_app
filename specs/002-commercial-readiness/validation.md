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

## Direct verification status

| Area | Status | Notes |
|---|---|---|
| Google custom provider | UNVERIFIED | Credentials and hosted provider configuration are not present in the repository. |
| Kakao custom provider | UNVERIFIED | Credentials and hosted provider configuration are not present in the repository. |
| Naver custom provider | UNVERIFIED | Credentials and provider approval are external prerequisites. |
| Guardian mobile identity provider | DISABLED | Production adapter must remain fail-closed until a provider contract and credentials exist. |
| Disposable SQL/RLS environment | UNVERIFIED | Requires a configured disposable database URL. |
| Backup restore and alert delivery | UNVERIFIED | Requires production-equivalent external services. |
