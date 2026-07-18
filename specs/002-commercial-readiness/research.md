# Research: Commercial Readiness Foundation

## Decision 1: Use three email-optional custom social providers

**Decision**: Configure Google and Kakao as custom OIDC providers and Naver as a custom OAuth2 provider. Set each provider to allow an identity without provider email and collect a separately verified service email during profile completion.

**Rationale**: Supabase Auth automatically links OAuth identities when a provider email matches an existing user. The approved product rule prohibits automatic linking and requires recent authentication before a manual link. Supabase custom providers support email-optional accounts, standard OAuth sign-in, and a three-provider free-plan quota that exactly covers the required providers.

**Alternatives considered**:

- Built-in Google and Kakao providers: rejected because matching provider emails can trigger automatic linking.
- Accept automatic linking for verified provider email: rejected because it conflicts with the approved account policy.
- Replace Supabase Auth: rejected because it would expand migration risk and weaken existing RLS integration.

**Primary references**:

- https://supabase.com/docs/guides/auth/auth-identity-linking
- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://developers.naver.com/products/terms/

## Decision 2: Keep Supabase Auth for passwords, sessions, and identities

**Decision**: Continue using Supabase Auth for email verification, password verification, OAuth identity records, access tokens, refresh-token rotation, recovery links, and manual identity linking. Add application account-state and session-age checks at protected server boundaries.

**Rationale**: The current project already uses Supabase SSR cookies and RLS depends on `auth.uid()`. Reuse avoids a risky identity migration while application checks supply guardian, restriction, inactivity, absolute-age, and recent-reauthentication rules that are not room roles.

**Alternatives considered**:

- A second authentication framework: rejected because two session authorities would complicate RLS and account recovery.
- Browser-direct password sign-in: rejected because login must apply shared IP and account request controls before calling Auth.

**Primary references**:

- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/auth-identity-linking

## Decision 3: Use separate protected tables plus RLS

**Decision**: Keep display and lifecycle fields in `profiles`, move application-managed private fields to `private_profiles`, store service roles in `service_role_assignments`, and enable RLS with least-privilege policies on every new exposed table. Sensitive mutations use narrow security-definer functions with fixed search paths and internal authorization checks.

**Rationale**: Separate tables prevent wildcard profile queries from disclosing private fields. RLS supplies defense in depth for browser and server access, while transactional functions are necessary for invitation counts, sanctions, and shared request-control decisions.

**Alternatives considered**:

- One expanded profile table: rejected because column exposure and administrative lookup are harder to constrain.
- Service-role-only data access for all tables: rejected because it bypasses user-scoped RLS and increases backend blast radius.

**Primary references**:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/postgres/column-level-security
- https://supabase.com/docs/guides/database/secure-data

## Decision 4: Use an authenticated encryption envelope

**Decision**: Encrypt private profile values with AES-256-GCM using a random 96-bit IV, a 128-bit authentication tag, record-bound additional authenticated data, and a versioned 256-bit key supplied as a server-only deployment secret. Store ciphertext, IV, tag, and key version; store normalized HMAC search keys separately for exact lookup.

**Rationale**: Authenticated encryption detects modification as well as hiding plaintext. Versioning supports key rotation without an all-at-once outage. Random IVs prevent equality leakage, while HMAC lookup avoids deterministic encryption.

**Alternatives considered**:

- Database-only disk encryption: rejected because privileged application queries would still expose plaintext columns.
- Deterministic encryption for search: rejected because it leaks equality and complicates rotation.
- Database key storage: rejected because it removes separation between ciphertext and key material.

**Primary reference**:

- https://nodejs.org/api/crypto.html

## Decision 5: Use PostgreSQL transactional request-control state first

**Decision**: Define a `RateLimitStore` interface and implement the initial shared store through transactional PostgreSQL functions and short-lived counter rows. Keep policy evaluation as pure TypeScript. A later Redis-compatible adapter may replace the store without changing routes or policy tests.

**Rationale**: The current application already has one shared production database and no cache service. PostgreSQL provides atomic counters across server instances and permits the exact repeated-excess and block semantics without introducing unconfigured infrastructure. Expired counter rows are pruned by a scheduled maintenance function.

**Alternatives considered**:

- In-memory counters: rejected because serverless instances do not share state.
- Add a managed Redis service immediately: deferred because it adds credentials, billing, and operational scope before measured load requires it.
- Perform slow database access in Next middleware: rejected; middleware performs session refresh and coarse route gating, while API handlers call the shared limiter.

**Primary references**:

- https://nextjs.org/docs/app/getting-started/proxy
- https://supabase.com/docs/guides/database/overview

## Decision 6: Keep authoritative checks out of middleware

**Decision**: Middleware refreshes authentication cookies and performs only cheap route classification. API routes, Server Actions, repositories, and RLS perform authoritative account-state and capability checks.

**Rationale**: Next.js documents middleware/proxy as unsuitable for slow data fetching or complete session management. Critical authorization must remain at execution and data boundaries.

**Alternative considered**: Centralize all permissions in middleware; rejected because middleware results can become stale and do not protect direct data access.

**Primary reference**:

- https://nextjs.org/docs/app/getting-started/proxy

## Decision 7: Use an adapter for legal-guardian verification

**Decision**: Define a provider-neutral `GuardianVerificationProvider` server interface. Ship a disabled production adapter and deterministic test adapter. The child account remains `pending_guardian_consent` until a contracted Korean mobile identity-verification provider returns verified evidence.

**Rationale**: The service must support all ages, but repository code cannot include a provider contract or credential that does not yet exist. A fail-closed adapter makes the incomplete external activation explicit and testable.

**Alternatives considered**:

- Email-only guardian consent: rejected because it does not provide the approved mobile identity-verification evidence.
- Activate child accounts before provider completion: rejected because it violates the consent gate.

**Primary references**:

- https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=02&joNo=0022&lsiSeq=270351&urlMode=lsScJoRltInfoR
- https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0038&lsiSeq=270351&urlMode=lsScJoRltInfoR

## Decision 8: Preserve existing behavior through additive migration and compatibility mapping

**Decision**: Introduce new tables, columns, constraints, policies, and functions in one forward migration after explicit approval. Migrate the existing service-admin boolean into role assignments, map inactive profiles to restricted state, replace stored email with a non-personal compatibility value, clear legacy phone values after encrypted migration, and retain compatibility reads only until application code switches.

**Rationale**: Existing production-shaped data and screens must remain usable while plaintext duplication and single-boolean authorization are removed. A reversible deployment sequence is safer than dropping columns before new reads are live.

**Alternatives considered**:

- Rewrite the initial schema migration: rejected because applied migrations must remain immutable.
- Immediate destructive column drops: rejected because rollback and mixed-version deployment would be unsafe.

## Decision 9: Use Node test runner and contract-focused integration fakes

**Decision**: Extend the existing Node test runner setup to cover pure TypeScript policies, route request/response helpers, provider adapters, repositories through explicit fakes, and generated coverage. Validate SQL/RLS with checked SQL assertions and staging quickstart steps. Use direct browser execution for configured end-to-end provider flows.

**Rationale**: The repository already has a working dependency-free test pattern. Adding behavior before a new test framework would delay security logic and require network installation. Provider credentials and a live database remain staging prerequisites and are reported honestly.

**Alternatives considered**:

- Introduce a large test framework immediately: rejected for this foundation because existing tooling can prove the pure and HTTP contract behavior without new dependencies.
- Treat mocks as proof of provider activation: rejected; live provider readiness is a separate staging result.

