# Commercial Readiness Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing shared scheduling application into a secure public multi-user service with controlled identity, invitations, administration, support, privacy, abuse prevention, and operational recovery.

**Architecture:** Keep Supabase Auth and PostgreSQL as identity and data authorities, place pure rules in focused TypeScript domain modules, enforce permissions again in RLS and transactional functions, and keep private data behind server-only authenticated encryption. All social identities use email-optional custom providers so account linking requires an authenticated explicit action.

**Tech Stack:** TypeScript 5.7, Node.js 22, Next.js 15 App Router, React 19, Supabase Auth/PostgreSQL/RLS, Zod, Tailwind CSS, Node test runner, Node crypto

## Global Constraints

- Target market is the Republic of Korea and registration has no age ceiling.
- Users under 14 remain guardian-pending until verified legal-guardian mobile identity consent.
- Google, Kakao, and Naver use email-optional custom providers; provider email never triggers account linking.
- General API policy is 90 requests without delay, requests 91–120 delayed one to three seconds, request 121 rejected, and three hard excesses in ten minutes block the IP for 15 minutes.
- Login, password change, recovery initiation, and invitation validation allow 20 attempts per IP in five minutes; login also limits pseudonymized account identity.
- Passwords, raw tokens, provider tokens, invitation tokens, inquiry bodies, and decrypted private values never enter logs.
- Changed behavior follows red-green-refactor and affected line and function coverage remains at least 80 percent.
- Database migrations require explicit user approval before creation or modification.
- Existing user changes, including `.gitignore`, remain untouched.

---

### Task 1: Establish the Baseline and Test Harness

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/test/security-fixtures.mjs`
- Create: `specs/002-commercial-readiness/validation.md`

**Interfaces:**
- Produces: `npm run test:security`, `npm run test:coverage`, deterministic `fixedClock`, `requestHeaders`, and `memoryAuditSink` test helpers.

- [ ] **Step 1: Run the untouched baseline**

Run:

```bash
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Expected: record exact exit codes and existing failures before changing scripts.

- [ ] **Step 2: Add security test and coverage scripts**

```json
{
  "scripts": {
    "test:unit": "node --no-warnings --experimental-strip-types --test src/**/*.test.mjs",
    "test:security": "node --no-warnings --experimental-strip-types --test src/domain/**/*.test.mjs src/lib/**/*.test.mjs src/data/repositories/*.test.mjs",
    "test:coverage": "node --no-warnings --experimental-strip-types --experimental-test-coverage --test src/**/*.test.mjs"
  }
}
```

Merge these entries with existing scripts and preserve all other package metadata.

- [ ] **Step 3: Add deterministic fixtures**

```js
export const fixedNow = new Date('2026-07-18T00:00:00.000Z');

export function fixedClock() {
  return { now: () => new Date(fixedNow) };
}

export function requestHeaders(values = {}) {
  return new Headers({ host: 'localhost:3000', origin: 'http://localhost:3000', ...values });
}

export function memoryAuditSink() {
  const events = [];
  return { events, append: async (event) => { events.push(event); } };
}
```

- [ ] **Step 4: Document environment names without values**

Add variable names for custom providers, `PRIVATE_DATA_KEY_V1`, `PRIVATE_DATA_ACTIVE_KEY_VERSION`, `SECURITY_HMAC_KEY`, trusted proxy mode, guardian provider mode, and maintenance authorization. Never add credentials.

- [ ] **Step 5: Re-run the baseline and commit**

```bash
npm run test:unit
git add package.json .env.example src/test/security-fixtures.mjs specs/002-commercial-readiness/validation.md
git commit -m "test: establish commercial readiness baseline"
```

### Task 2: Implement Account and Capability Policies

**Files:**
- Create: `src/domain/auth/account-policy.test.mjs`
- Create: `src/domain/auth/account-policy.ts`
- Create: `src/domain/authorization/capabilities.test.mjs`
- Create: `src/domain/authorization/capabilities.ts`

**Interfaces:**
- Produces: `canAccessArea(state, area)`, `sessionDecision(session, now)`, `hasRecentReauthentication(at, now)`, `hasRoomCapability(role, capability)`, `hasServiceCapability(roles, capability)`.

- [ ] **Step 1: Write failing account policy tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessArea, hasRecentReauthentication, sessionDecision } from './account-policy.ts';

test('guardian-pending account can reach consent and support but not rooms', () => {
  assert.equal(canAccessArea('pending_guardian_consent', 'guardian_consent'), true);
  assert.equal(canAccessArea('pending_guardian_consent', 'support'), true);
  assert.equal(canAccessArea('pending_guardian_consent', 'rooms'), false);
});

test('session expires at seven idle days or thirty absolute days', () => {
  const now = new Date('2026-07-18T00:00:00Z');
  assert.equal(sessionDecision({ startedAt: '2026-06-17T23:59:59Z', lastSeenAt: '2026-07-17T23:59:59Z' }, now), 'expired');
  assert.equal(sessionDecision({ startedAt: '2026-07-17T00:00:00Z', lastSeenAt: '2026-07-10T00:00:00Z' }, now), 'expired');
});

test('sensitive action requires reauthentication within ten minutes', () => {
  assert.equal(hasRecentReauthentication('2026-07-17T23:51:00Z', new Date('2026-07-18T00:00:00Z')), true);
  assert.equal(hasRecentReauthentication('2026-07-17T23:49:59Z', new Date('2026-07-18T00:00:00Z')), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:security -- src/domain/auth/account-policy.test.mjs`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the account policy**

```ts
export type AccountState = 'pending_email_verification' | 'pending_profile' | 'pending_guardian_consent' | 'active' | 'restricted' | 'suspended' | 'deletion_pending' | 'deleted';
export type AccessArea = 'profile' | 'guardian_consent' | 'support' | 'privacy' | 'rooms' | 'admin';

const allowed: Record<AccountState, ReadonlySet<AccessArea>> = {
  pending_email_verification: new Set(['profile']),
  pending_profile: new Set(['profile', 'privacy']),
  pending_guardian_consent: new Set(['profile', 'guardian_consent', 'support', 'privacy']),
  active: new Set(['profile', 'support', 'privacy', 'rooms', 'admin']),
  restricted: new Set(['profile', 'support', 'privacy']),
  suspended: new Set(['profile', 'support', 'privacy']),
  deletion_pending: new Set(['profile', 'privacy']),
  deleted: new Set(),
};

export function canAccessArea(state: AccountState, area: AccessArea) {
  return allowed[state].has(area);
}

export function sessionDecision(session: { startedAt: string; lastSeenAt: string }, now = new Date()) {
  const absolute = now.getTime() - new Date(session.startedAt).getTime();
  const idle = now.getTime() - new Date(session.lastSeenAt).getTime();
  return absolute >= 30 * 86_400_000 || idle >= 7 * 86_400_000 ? 'expired' : 'active';
}

export function hasRecentReauthentication(at: string | null, now = new Date()) {
  return Boolean(at) && now.getTime() - new Date(at as string).getTime() <= 10 * 60_000;
}
```

- [ ] **Step 4: Write capability matrix tests, watch them fail, and implement exact matrices**

```ts
export type RoomRole = 'owner' | 'manager' | 'member' | 'viewer';
export type RoomCapability = 'read' | 'create_schedule' | 'edit_any_schedule' | 'create_invite' | 'manage_members' | 'manage_managers' | 'transfer_ownership' | 'delete_room';
export type ServiceRole = 'super_admin' | 'operations_admin' | 'support_admin' | 'auditor';
export type ServiceCapability = 'assign_roles' | 'operate_users' | 'operate_rooms' | 'handle_reports' | 'read_inquiry' | 'reply_inquiry' | 'read_audit' | 'release_ip_block';

export function hasRoomCapability(role: RoomRole, capability: RoomCapability): boolean;
export function hasServiceCapability(roles: readonly ServiceRole[], capability: ServiceCapability): boolean;
```

Implement the exact approved matrices from the design document; tests must enumerate every role-capability pair.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:security -- src/domain/auth/account-policy.test.mjs src/domain/authorization/capabilities.test.mjs
git add src/domain/auth src/domain/authorization
git commit -m "feat: add account and capability policies"
```

### Task 3: Implement Encryption, Audit, and Rate Policies

**Files:**
- Create: `src/lib/privacy/encryption.test.mjs`
- Create: `src/lib/privacy/encryption.ts`
- Create: `src/lib/audit/audit-event.test.mjs`
- Create: `src/lib/audit/audit-event.ts`
- Create: `src/domain/rate-limit/policy.test.mjs`
- Create: `src/domain/rate-limit/policy.ts`

**Interfaces:**
- Produces: `encryptField`, `decryptField`, `lookupHash`, `createAuditEvent`, `evaluateGeneralCount`, `evaluateSensitiveCount`, `shouldBlockForViolations`.

- [ ] **Step 1: Write failing encryption tests**

Test round-trip, random IV inequality, AAD record binding, tamper rejection, wrong key rejection, and normalized HMAC equality.

```js
const key = Buffer.alloc(32, 7).toString('base64url');
const envelope = encryptField('010-1234-5678', { keyVersion: 1, key, aad: 'private-profile:user-1:phone' });
assert.equal(decryptField(envelope, { keys: { 1: key }, aad: 'private-profile:user-1:phone' }), '010-1234-5678');
assert.throws(() => decryptField({ ...envelope, ciphertext: `${envelope.ciphertext}A` }, { keys: { 1: key }, aad: 'private-profile:user-1:phone' }));
```

- [ ] **Step 2: Verify RED and implement encryption**

```ts
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export interface EncryptedField { ciphertext: string; iv: string; authTag: string; keyVersion: number }

export function encryptField(value: string, options: { keyVersion: number; key: string; aad: string }): EncryptedField {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(options.key, 'base64url'), iv);
  cipher.setAAD(Buffer.from(options.aad));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64url'), iv: iv.toString('base64url'), authTag: cipher.getAuthTag().toString('base64url'), keyVersion: options.keyVersion };
}

export function decryptField(field: EncryptedField, options: { keys: Record<number, string>; aad: string }) {
  const key = options.keys[field.keyVersion];
  if (!key) throw new Error('unknown_key_version');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64url'), Buffer.from(field.iv, 'base64url'));
  decipher.setAAD(Buffer.from(options.aad));
  decipher.setAuthTag(Buffer.from(field.authTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(field.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

export function lookupHash(value: string, key: string) {
  return createHmac('sha256', Buffer.from(key, 'base64url')).update(value.trim().toLowerCase()).digest('base64url');
}
```

- [ ] **Step 3: Write failing audit and rate-policy tests**

```js
assert.deepEqual(evaluateGeneralCount(90), { action: 'allow' });
assert.equal(evaluateGeneralCount(91, () => 0).delayMs, 1000);
assert.equal(evaluateGeneralCount(120, () => 0.999).delayMs, 3000);
assert.deepEqual(evaluateGeneralCount(121), { action: 'reject', retryAfterSeconds: 60, hardExcess: true });
assert.equal(shouldBlockForViolations(3), true);
```

Audit tests must reject unknown metadata keys and remove raw token, password, body, phone, address, and private-value keys.

- [ ] **Step 4: Implement minimal pure policies and verify GREEN**

```ts
export function evaluateGeneralCount(count: number, random = Math.random) {
  if (count <= 90) return { action: 'allow' as const };
  if (count <= 120) return { action: 'delay' as const, delayMs: 1000 + Math.floor(random() * 2001) };
  return { action: 'reject' as const, retryAfterSeconds: 60, hardExcess: true };
}

export function evaluateSensitiveCount(count: number) {
  return count <= 20 ? { action: 'allow' as const } : { action: 'reject' as const, retryAfterSeconds: 300 };
}

export function shouldBlockForViolations(countWithinTenMinutes: number) {
  return countWithinTenMinutes >= 3;
}
```

- [ ] **Step 5: Commit**

```bash
npm run test:security -- src/lib/privacy/encryption.test.mjs src/lib/audit/audit-event.test.mjs src/domain/rate-limit/policy.test.mjs
git add src/lib/privacy src/lib/audit src/domain/rate-limit
git commit -m "feat: add privacy audit and request policies"
```

### Task 4: Add the Approved Database Foundation

**Files:**
- Create: `supabase/migrations/20260718120000_commercial_readiness_foundation.sql`
- Create: `supabase/tests/commercial_readiness_security.sql`
- Modify: `src/data/database.types.ts`
- Create: `src/data/repositories/security-repository.ts`

**Interfaces:**
- Produces database functions `redeem_room_invite`, `evaluate_request_limit`, `append_audit_event`, `apply_admin_sanction`, and `release_admin_sanction` plus typed repository wrappers.

- [ ] **Step 1: Confirm explicit migration approval**

Do not create or modify migration files until the user explicitly approves this task.

- [ ] **Step 2: Write failing SQL assertions**

The SQL test must begin a transaction, create isolated identities, assert RLS denial across users and roles, assert append-only audit denial, race the final invitation use through the function contract, validate request counts at 90/91/120/121, and roll back.

- [ ] **Step 3: Verify RED in a disposable database**

Run: `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/commercial_readiness_security.sql`  
Expected: FAIL because new tables and functions do not exist. If no disposable database is configured, record the test as unverified rather than passed.

- [ ] **Step 4: Implement the additive migration**

Create the entities, constraints, indexes, RLS policies, triggers, grants, and functions defined in `specs/002-commercial-readiness/data-model.md`. Migrate the legacy service-admin boolean into a `super_admin` assignment, map inactive accounts to restricted, remove real email and phone duplication from `profiles`, hash active invitation codes, and preserve rollback-safe compatibility fields.

All security-definer functions must include:

```sql
language plpgsql
security definer
set search_path = public, extensions
```

Enable RLS explicitly for every new exposed table:

```sql
alter table public.private_profiles enable row level security;
alter table public.account_email_references enable row level security;
alter table public.guardian_consents enable row level security;
alter table public.service_role_assignments enable row level security;
alter table public.invitation_attempts enable row level security;
alter table public.support_inquiries enable row level security;
alter table public.support_inquiry_messages enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_violations enable row level security;
alter table public.ip_blocks enable row level security;
alter table public.deletion_records enable row level security;
```

- [ ] **Step 5: Reconcile TypeScript types and repository signatures**

```ts
export interface RequestLimitStore {
  evaluate(input: { policy: 'general' | 'sensitive' | 'login_account'; subjectKey: string; requestId: string; now: string }): Promise<{ action: 'allow' | 'delay' | 'reject' | 'block'; count: number; retryAfterSeconds: number | null }>;
}

export interface AuditStore {
  append(event: AuditEvent): Promise<void>;
}
```

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck
git add supabase/migrations/20260718120000_commercial_readiness_foundation.sql supabase/tests/commercial_readiness_security.sql src/data/database.types.ts src/data/repositories/security-repository.ts
git commit -m "feat: add commercial security schema"
```

### Task 5: Implement Secure Registration, Login, Providers, and Guardian Consent

**Files:**
- Create: `src/domain/auth/auth-input.test.mjs`
- Create: `src/lib/auth/provider-registry.test.mjs`
- Create: `src/lib/auth/provider-registry.ts`
- Create: `src/lib/auth/guardian-verification.test.mjs`
- Create: `src/lib/auth/guardian-verification.ts`
- Create: routes under `src/app/api/auth/` and `src/app/auth/callback/route.ts`
- Modify: `src/components/app/LoginForm.tsx`
- Create: `src/components/auth/AuthForms.tsx`
- Create: `src/app/signup/page.tsx`, `src/app/recovery/page.tsx`, `src/app/auth/complete-profile/page.tsx`
- Modify: `src/lib/auth.ts`, `src/middleware.ts`

**Interfaces:**
- Consumes: account policy, request limiter, private-field encryption, audit store.
- Produces: the authentication HTTP contract in `contracts/http-api.md` and `GuardianVerificationProvider.start/verify`.

- [ ] **Step 1: Write and run failing input, provider, and guardian tests**

Provider tests require `custom:google`, `custom:kakao`, and `custom:naver`, `email_optional` activation documentation, exact callback allowlisting, disabled status without credentials, and link mode requiring recent reauthentication.

```ts
export interface GuardianVerificationProvider {
  start(input: { childUserId: string; guardianPhone: string; requestId: string }): Promise<{ verificationId: string; redirectUrl: string }>;
  verify(input: { verificationId: string; callbackPayload: unknown }): Promise<{ evidenceReference: string; verifiedAt: string }>;
}
```

- [ ] **Step 2: Implement provider and guardian adapters**

Production guardian mode throws `guardian_provider_unavailable` until configured. Test mode accepts only a signed deterministic fixture and must throw if `NODE_ENV=production`.

- [ ] **Step 3: Implement server-controlled auth routes**

Every mutation parses Zod input, calls same-origin/CSRF guard, applies the specified limit, returns the shared error envelope, and never returns raw Auth errors. Password login no longer occurs directly in the browser.

- [ ] **Step 4: Implement UI and state gates**

The login page shows email login, three provider buttons with disabled reasons, signup and recovery links. Profile completion requests service email verification, display name, birth date, optional phone, and policy consent. Guardian-pending users receive consent and support actions only.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:security -- src/domain/auth/auth-input.test.mjs src/lib/auth/provider-registry.test.mjs src/lib/auth/guardian-verification.test.mjs
npm run typecheck
git add src/app/api/auth src/app/auth src/app/signup src/app/recovery src/components/auth src/components/app/LoginForm.tsx src/lib/auth src/lib/auth.ts src/middleware.ts
git commit -m "feat: add secure public account flows"
```

### Task 6: Implement Controlled Invitations

**Files:**
- Create: `src/domain/invites/invite-policy.test.mjs`
- Create: `src/domain/invites/invite-policy.ts`
- Create: `src/data/repositories/invite-repository.test.mjs`
- Create: `src/data/repositories/invite-repository.ts`
- Create: invitation routes under `src/app/api/rooms/[roomId]/invites/` and `src/app/api/invites/[token]/`
- Create: `src/app/join/[token]/page.tsx`
- Create: `src/components/app/RoomInvitePanel.tsx`
- Modify: `src/domain/entities.ts`, `src/components/app/ScheduleWorkspace.tsx`

**Interfaces:**
- Produces: `createInviteToken`, `hashInviteToken`, `invitationPreview`, repository create/redeem/revoke/replace, and viewer-compatible UI.

- [ ] **Step 1: Write failing domain and repository tests**

```ts
export function createInviteToken(): string;
export function hashInviteToken(token: string, hmacKey: string): string;
export function invitationPreview(row: InvitePreviewRow): { roomName: string; description: string | null; inviterDisplayName: string; grantRole: 'member' | 'viewer'; expiresAt: string };
```

Tests cover malformed, expired, revoked, exhausted, replaced, existing-member, role elevation, and final-use concurrency results.

- [ ] **Step 2: Verify RED and implement pure token/projection code**

Use 32 random bytes encoded base64url and HMAC-SHA-256 storage. The preview projection must not accept schedule, member-list, address, phone, or notes fields.

- [ ] **Step 3: Implement repository and routes**

Raw tokens are returned exactly once from create/replace. Preview and redemption apply the sensitive limit. Redemption delegates all count and membership mutation to `redeem_room_invite`.

- [ ] **Step 4: Implement UI and viewer behavior**

Viewer may read permitted schedule data but cannot render or call mutation controls. Manager controls never offer manager or owner as link grants.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:security -- src/domain/invites/invite-policy.test.mjs src/data/repositories/invite-repository.test.mjs
npm run typecheck
git add src/domain/invites src/data/repositories/invite-repository* src/app/api/rooms src/app/api/invites src/app/join src/components/app/RoomInvitePanel.tsx src/domain/entities.ts src/components/app/ScheduleWorkspace.tsx
git commit -m "feat: add controlled room invitations"
```

### Task 7: Implement Private Inquiries and Scoped Administration

**Files:**
- Create: `src/domain/support/inquiry-policy.test.mjs`, `src/domain/support/inquiry-policy.ts`
- Create: `src/data/repositories/inquiry-repository.test.mjs`, `src/data/repositories/inquiry-repository.ts`
- Create: `src/domain/authorization/admin-policy.test.mjs`, `src/domain/authorization/admin-policy.ts`
- Create: `src/data/repositories/admin-repository.test.mjs`, `src/data/repositories/admin-repository.ts`
- Create: routes under `src/app/api/inquiries`, `src/app/api/reports`, and `src/app/api/admin`
- Create: `src/components/support/InquiryWorkspace.tsx`, `src/components/admin/AdminWorkspace.tsx`
- Create: support pages and modify `src/app/admin/page.tsx`

**Interfaces:**
- Produces: inquiry transition policy, staff claim/read rules, role masking, report and sanction use cases, last-super-admin invariant, PC admin workspace.

- [ ] **Step 1: Write failing policy and repository tests**

```ts
export type InquiryStatus = 'open' | 'in_progress' | 'answered' | 'closed';
export function canCreateInquiry(state: AccountState, category: 'general' | 'account' | 'consent' | 'privacy' | 'appeal'): boolean;
export function canTransitionInquiry(actor: 'user' | 'support', from: InquiryStatus, to: InquiryStatus): boolean;
export function maskAdminRecord(role: ServiceRole, record: AdminUserRecord): AdminUserView;
```

Tests enumerate every state/category, transition, role/view, sanction, release, and last-super-admin case.

- [ ] **Step 2: Implement domain policies and verify GREEN**

Limited accounts can create only account, consent, privacy, or appeal inquiries. Only owner users and assigned/claiming support actors can decrypt inquiry content. Auditor output never includes inquiry body or private profile fields.

- [ ] **Step 3: Implement repositories and routes**

Inquiry creation writes encrypted content and a body-free notification. First staff content read writes an audit event. Sanction and release delegate to transactions and require reasons. User report creation stores optional encrypted details.

- [ ] **Step 4: Implement responsive support and PC-first admin UI**

Admin navigation includes users, rooms, reports, inquiries, sanctions, audit, and IP blocks. Unauthorized tabs are absent and direct route access still returns 403.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:security -- src/domain/support/inquiry-policy.test.mjs src/data/repositories/inquiry-repository.test.mjs src/domain/authorization/admin-policy.test.mjs src/data/repositories/admin-repository.test.mjs
npm run typecheck
git add src/domain/support src/domain/authorization/admin-policy* src/data/repositories/inquiry-repository* src/data/repositories/admin-repository* src/app/api/inquiries src/app/api/reports src/app/api/admin src/app/support src/components/support src/components/admin src/app/admin/page.tsx
git commit -m "feat: add private support and scoped administration"
```

### Task 8: Apply Shared Request Controls

**Files:**
- Create: `src/lib/rate-limit/client-ip.test.mjs`, `src/lib/rate-limit/client-ip.ts`
- Create: `src/lib/rate-limit/rate-limit-service.test.mjs`, `src/lib/rate-limit/rate-limit-service.ts`
- Create: `src/lib/rate-limit/with-rate-limit.ts`
- Create: `src/app/api/admin/ip-blocks/[blockId]/release/route.ts`
- Modify: protected API routes

**Interfaces:**
- Produces: `resolveClientIp`, `RateLimitService.check`, `withRateLimit`, standard headers, authorized block release.

- [ ] **Step 1: Write failing IP and service tests**

Test direct development IP, configured Vercel proxy value, multiple forwarded addresses, malformed values, untrusted headers, delayed injectable sleep, response headers, IP and account double checks, automatic block, expiry, and manual release.

- [ ] **Step 2: Implement trusted IP resolution**

```ts
export function resolveClientIp(headers: Headers, config: { trustedProxy: 'vercel' | 'none'; directIp?: string }) {
  if (config.trustedProxy === 'vercel') {
    const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (first && isIP(first)) return first;
  }
  if (config.directIp && isIP(config.directIp)) return config.directIp;
  return null;
}
```

Never trust forwarding headers in `none` mode.

- [ ] **Step 3: Implement service and wrapper**

The service HMACs raw IP and normalized login account before store calls, calls both login subjects, sleeps only for delay action, returns 429 for reject/block, emits `Retry-After`, and appends a redacted event.

- [ ] **Step 4: Apply wrappers and verify exact thresholds**

Apply general policy to application APIs and sensitive policy to login, password change, recovery initiation, and invitation validation. Run boundary and cross-store-client tests.

- [ ] **Step 5: Commit**

```bash
npm run test:security -- src/domain/rate-limit/policy.test.mjs src/lib/rate-limit/client-ip.test.mjs src/lib/rate-limit/rate-limit-service.test.mjs
git add src/lib/rate-limit src/app/api
git commit -m "feat: enforce shared request controls"
```

### Task 9: Implement Privacy Lifecycle and Operations

**Files:**
- Create: `src/domain/privacy/privacy-lifecycle.test.mjs`, `src/domain/privacy/privacy-lifecycle.ts`
- Create: `src/data/repositories/privacy-repository.test.mjs`, `src/data/repositories/privacy-repository.ts`
- Create: privacy routes under `src/app/api/privacy`
- Create: `scripts/run-privacy-maintenance.mjs`
- Create: `src/lib/operations/monitoring.ts`
- Create: `docs/operations/auth-providers.md`, `docs/operations/privacy-retention.md`, `docs/operations/incident-response.md`, `docs/operations/backup-restore.md`

**Interfaces:**
- Produces: privacy export, correction, withdrawal, cancellation, deletion plan, restore reconciliation, key rotation, redacted monitoring event.

- [ ] **Step 1: Write failing lifecycle and repository tests**

```ts
export function deletionDueAt(requestedAt: Date) { return new Date(requestedAt.getTime() + 7 * 86_400_000); }
export function isDeletionEligible(dueAt: Date, now: Date) { return now.getTime() >= dueAt.getTime(); }
export function retentionUntil(kind: 'inquiry' | 'audit' | 'security', from: Date): Date;
```

Tests cover immediate revocation, cancellation before irreversible work, three-year/one-year/90-day retention, tamper failure, key rotation, deletion idempotency, and restored tombstone replay.

- [ ] **Step 2: Implement lifecycle and repository operations**

Every decrypt requires an explicit purpose and audit append. Withdrawal revokes sessions before returning success. Maintenance accepts no user-supplied target IDs and runs only with a server maintenance secret.

- [ ] **Step 3: Implement routes, jobs, monitoring, and runbooks**

Runbooks include exact prerequisites, safe commands, expected evidence, rollback/containment, and a section distinguishing direct verification from documentation-only readiness.

- [ ] **Step 4: Verify and commit**

```bash
npm run test:security -- src/domain/privacy/privacy-lifecycle.test.mjs src/data/repositories/privacy-repository.test.mjs
npm run typecheck
git add src/domain/privacy src/data/repositories/privacy-repository* src/app/api/privacy scripts/run-privacy-maintenance.mjs src/lib/operations docs/operations
git commit -m "feat: add privacy lifecycle and recovery operations"
```

### Task 10: Integrate, Verify, and Reconcile Requirements

**Files:**
- Modify: `src/components/app/AppFrame.tsx`, `src/components/app/BottomNavigation.tsx`
- Modify: new auth, support, and admin components for accessibility
- Modify: `specs/002-commercial-readiness/tasks.md`
- Modify: `specs/002-commercial-readiness/validation.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces final requirement evidence, direct browser results, explicit external gaps, and a green release verification command set.

- [ ] **Step 1: Add navigation and limited-account recovery paths**

Active users see rooms and support. Limited users see only account, consent where applicable, privacy, support, and logout. Service-role navigation reflects server-resolved capabilities.

- [ ] **Step 2: Complete accessibility review**

All fields have visible labels, error text is associated through `aria-describedby`, async results use an appropriate live region, dialogs trap and restore focus, and keyboard focus remains visible. Check mobile 360 px and admin 1280 px layouts.

- [ ] **Step 3: Run fresh full verification**

```bash
npm run test:unit
npm run test:coverage
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: zero test failures, affected line and function coverage at least 80%, zero type errors, zero lint errors, build exit zero, and no whitespace errors.

- [ ] **Step 4: Run quickstart evidence**

Execute every configured scenario in `specs/002-commercial-readiness/quickstart.md`. Record exact browser/version, provider status, guardian status, SQL concurrency, schedule conflict, backup restore, and alert delivery as verified, disabled, blocked, or unverified. Never infer a pass.

- [ ] **Step 5: Reconcile and commit**

Mark each completed SpecKit task `[x]`, map FR-001 through FR-062 and SC-001 through SC-012 to tests or recorded evidence, and leave blocked external items unchecked with reasons.

```bash
git add specs/002-commercial-readiness/tasks.md specs/002-commercial-readiness/validation.md src/components/app/AppFrame.tsx src/components/app/BottomNavigation.tsx src/components/auth src/components/support src/components/admin
git commit -m "test: verify commercial readiness foundation"
```
