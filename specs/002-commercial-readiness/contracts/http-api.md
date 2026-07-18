# HTTP Contract: Commercial Readiness Foundation

## Shared conventions

- JSON request and response bodies use UTF-8.
- Every response includes `X-Request-Id`.
- Non-GET browser mutations require same-origin validation and CSRF protection.
- Authentication errors use stable messages that do not reveal account existence.
- `429` responses include `Retry-After` in seconds.
- Error body:

```json
{
  "error": {
    "code": "stable_reason_code",
    "message": "User-safe Korean message",
    "requestId": "request-correlation-id"
  }
}
```

## Authentication and profile

### POST /api/auth/register

Request: `email`, `password`, `displayName`, `termsVersion`, `privacyVersion`.

Success `202`: `{ "state": "pending_email_verification" }`.

Always returns an enumeration-safe outcome for duplicate email attempts.

### POST /api/auth/login

Request: `email`, `password`.

Success `200`: `{ "next": "/dashboard", "accountState": "active" }`.

Denied `401`: `invalid_credentials`. Limited states return only the permitted continuation route after valid authentication.

### POST /api/auth/recovery

Request: `email`.

Success `202`: `{ "accepted": true }` for known and unknown accounts.

### POST /api/auth/password

Requires recovery session or recent reauthentication. Request: `password`. Success revokes prior sessions.

### GET /api/auth/provider/:provider/start

Provider is `google`, `kakao`, or `naver`. Disabled providers return `provider_unavailable`. Success redirects only to the configured custom-provider authorization URL.

### GET /auth/callback

Validates callback code, state, exact continuation target, and mode (`signin` or `link`). Sign-in may continue to `/auth/complete-profile`; link mode requires an existing recent authenticated session.

### POST /api/auth/profile

Request: verified service-email token, `displayName`, `birthDate`, optional `phone`, consent versions. Returns `active` or `pending_guardian_consent`.

### POST /api/auth/reauthenticate

Request: current password or supported provider confirmation token. Success records a ten-minute sensitive-action window.

### POST /api/auth/identities/:provider/link

Requires recent reauthentication and an existing active account. Starts custom provider flow in `link` mode. Never accepts email as proof of ownership.

### POST /api/auth/guardian/verification

Starts the configured guardian verification adapter for a guardian-pending account. Disabled production adapter returns `guardian_provider_unavailable` and keeps the account pending.

### POST /api/auth/guardian/callback

Provider-to-server callback. Verifies evidence, updates consent and account state atomically, and returns no private provider payload.

## Invitations

### POST /api/rooms/:roomId/invites

Requires owner or manager. Request: `grantRole` (`member` or `viewer`), `expiresAt`, `maxUses`. Success `201` returns the raw token once, display hint, expiry, and max uses.

### GET /api/invites/:token

Applies the sensitive invitation-validation limit. Success returns only approved preview fields and current actionable state.

### POST /api/invites/:token/redeem

Requires active account. Success `200`: `{ "roomId": "uuid", "membershipRole": "member|viewer", "alreadyMember": false }`.

Stable denial codes: `invite_invalid`, `invite_expired`, `invite_revoked`, `invite_exhausted`, `account_not_active`.

### POST /api/rooms/:roomId/invites/:inviteId/revoke

Requires owner or manager and reason. Returns revoked status.

### POST /api/rooms/:roomId/invites/:inviteId/replace

Requires owner or manager. Atomically revokes the old invite and returns the replacement raw token once.

## Support inquiries

### POST /api/inquiries

Request: `category`, `subject`, `body`. Allowed categories depend on account state. Success `201` returns inquiry ID and `open`.

### GET /api/inquiries

Returns the current user's inquiries with status and timestamps; private message content is loaded only for an authorized detail request.

### GET /api/inquiries/:inquiryId

User owner or assigned/claiming support capability only. First staff content access creates an audit event.

### POST /api/inquiries/:inquiryId/claim

Support or super admin only. Atomically assigns the inquiry if unassigned or already assigned to the actor.

### POST /api/inquiries/:inquiryId/replies

User owner or assigned support actor. Appends encrypted message and preserves prior history.

### PATCH /api/inquiries/:inquiryId/status

Applies allowed transition. Users may close answered inquiries; support actors may move open to in-progress and in-progress to answered.

## Administration

### POST /api/reports

An active user submits an account or room report with reason code and optional encrypted detail. Success returns report ID and `open` status without exposing investigation fields.

### GET /api/admin/reports

Super, operations, and auditor roles receive their permitted report summaries; auditor access is read-only and masked.

### PATCH /api/admin/reports/:reportId

Super or operations admin assigns or transitions a report through open, investigating, resolved, or dismissed. Resolution requires a reason and creates an audit event.

### GET /api/admin/users

Super and operations admins receive scoped user summaries. Support receives explicit lookup-only summary. Auditor receives masked read-only summary.

### PATCH /api/admin/users/:userId/roles

Super admin only; recent reauthentication required. Prevents removal of the last active super admin.

### GET /api/admin/rooms

Returns operational room metadata, restriction state, report count, and member count without schedule content.

### POST /api/admin/sanctions

Super or operations admin. Request: target type/id, sanction type, reason, optional end. Writes sanction and target state atomically.

### POST /api/admin/sanctions/:sanctionId/release

Super or operations admin. Requires reason and creates a separate release record.

### GET /api/admin/audit

Role-scoped, masked, paginated filters for event type, actor, target, result, and time.

### GET /api/admin/ip-blocks

Super, operations, or auditor read access. Values are pseudonymized.

### POST /api/admin/ip-blocks/:blockId/release

Super or operations admin. Requires reason and records manual release.

### GET /api/admin/inquiries

Super and support admins receive scoped inquiry queues. Operations and auditors receive only redacted operational counts and metadata allowed by their role.

## Privacy

### GET /api/privacy/export

Requires recent reauthentication. Returns a generated export or asynchronous job reference without security-only internal metadata.

### PATCH /api/privacy/profile

Requires recent reauthentication. Updates private fields through encryption and records correction history.

### POST /api/privacy/withdraw

Requires recent reauthentication. Revokes sessions and product access immediately, records seven-day deletion due date, and returns the withdrawal deadline.

### POST /api/privacy/withdraw/cancel

Allowed during the seven-day period after strong reauthentication, unless a non-reversible deletion step has started.

## Request-control response metadata

Delayed or rejected requests may return:

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
- `Retry-After` for rejection and block

Headers never reveal another account's counter or raw IP value.
