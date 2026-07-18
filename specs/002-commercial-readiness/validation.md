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

## Direct verification status

| Area | Status | Notes |
|---|---|---|
| Google custom provider | UNVERIFIED | Credentials and hosted provider configuration are not present in the repository. |
| Kakao custom provider | UNVERIFIED | Credentials and hosted provider configuration are not present in the repository. |
| Naver custom provider | UNVERIFIED | Credentials and provider approval are external prerequisites. |
| Guardian mobile identity provider | DISABLED | Production adapter must remain fail-closed until a provider contract and credentials exist. |
| Disposable SQL/RLS environment | UNVERIFIED | Requires a configured disposable database URL. |
| Backup restore and alert delivery | UNVERIFIED | Requires production-equivalent external services. |
