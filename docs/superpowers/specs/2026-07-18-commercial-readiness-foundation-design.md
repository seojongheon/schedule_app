# Commercial Readiness Foundation Design

**Date:** 2026-07-18  
**Status:** Approved design pending written review  
**Target market:** Republic of Korea  
**Delivery model:** Staged vertical implementation within one commercial-readiness program

## 1. Purpose

This design upgrades the shared scheduling application from an administrator-provisioned product into a commercial multi-user service. It establishes user identity, room membership, privacy, authorization, invitation, administration, support, abuse prevention, audit, backup, recovery, and operational verification as one coherent foundation.

The implementation retains the existing Next.js App Router, TypeScript, Supabase Auth, PostgreSQL, Row-Level Security (RLS), and Tailwind CSS stack. Existing room, schedule, and member behavior remains compatible unless this design explicitly tightens access or data handling.

## 2. Scope and Delivery Boundaries

The program is divided into independently testable vertical stages:

1. Shared identity, authorization, privacy, encryption, and audit foundations
2. Email and social authentication, account recovery, session control, and child-account consent
3. Secure invitation-link lifecycle and atomic room participation
4. Role-separated administration, reports, sanctions, and support inquiries
5. Distributed request throttling, IP blocking, and security-event review
6. Cross-cutting privacy, concurrency, accessibility, compatibility, monitoring, backup, and recovery verification

All six stages are in scope. Each stage must produce working, testable software and may not weaken a control established by an earlier stage.

### Out of Scope

- Publicly readable room schedules
- Automatic account merging based only on matching email addresses
- Storage or use of third-party OAuth provider access or refresh tokens
- Marketing automation, billing, subscriptions, and payment processing
- Support inquiry file attachments
- Production activation of an external provider without valid credentials and provider-side approval

## 3. Actors and Roles

### 3.1 End-user account states

- `pending_email_verification`: email address has not been verified
- `pending_profile`: identity is verified but required profile and consent data is incomplete
- `pending_guardian_consent`: a user under 14 is awaiting verified legal-guardian consent
- `active`: the account may use authorized service features
- `restricted`: the user may authenticate but is blocked from protected product actions
- `suspended`: the account is blocked by an administrative sanction
- `deletion_pending`: access is revoked during the seven-day withdrawal period
- `deleted`: personally identifying application data has been deleted or irreversibly de-identified

Only `active` accounts may create rooms, redeem invitations, or view schedules. Authenticated `pending_guardian_consent`, `restricted`, and `suspended` accounts retain access only to account recovery, privacy requests, guardian-consent completion, and support inquiries so they can resolve or appeal their status.

### 3.2 Room roles

| Capability | Owner | Manager | Member | Viewer |
|---|---:|---:|---:|---:|
| View allowed room data | Yes | Yes | Yes | Yes |
| Create and edit own schedules | Yes | Yes | Yes | No |
| Edit all room schedules | Yes | Yes | No | No |
| Create member/viewer invitations | Yes | Yes | No | No |
| Manage members | Yes | Yes, except owner/manager elevation | No | No |
| Elevate or remove managers | Yes | No | No | No |
| Transfer ownership | Yes, after reauthentication | No | No | No |
| Delete room | Yes, after reauthentication | No | No | No |

Invitation links may grant only `member` or `viewer`. Manager elevation and ownership transfer require an existing member, recent reauthentication, and a direct authorized action.

### 3.3 Service administration roles

| Capability | Super admin | Operations admin | Support admin | Auditor |
|---|---:|---:|---:|---:|
| Assign service-admin roles | Yes | No | No | No |
| View users and rooms | Yes | Yes | Limited lookup | Masked read-only |
| Restrict accounts or rooms | Yes | Yes | No | No |
| Manage reports and sanctions | Yes | Yes | No | Read-only |
| Read inquiry content | Yes | No | Yes | Metadata only |
| Reply to inquiries | Yes | No | Yes | No |
| Read audit history | Yes | Scoped operations | Scoped support | Yes, masked |
| Manually release IP blocks | Yes | Yes | No | Read-only |

Service roles and room roles are separate. A service administrator receives no room membership or schedule access merely by holding an administrative role.

## 4. Architecture

### 4.1 Identity module

Supabase Auth remains the source of authentication identity, password hashing, email verification, OAuth identity, and refresh-token rotation. The application supports:

- Email/password registration and login
- Google, Kakao, and Naver through three Supabase Custom OAuth/OIDC providers configured without provider email as an account-linking key
- Password recovery through a short-lived, single-use email link
- Explicit social-identity linking after recent authentication to an existing account

All three social providers use email-optional custom-provider configuration so Supabase Auth does not automatically link identities by matching provider email. A new social user verifies a separate service email during profile completion. An existing user signs in and reauthenticates before manually linking a social identity. Provider callbacks allow only configured origins and exact callback paths. Provider access and refresh tokens are not persisted because the service does not call provider APIs after authentication.

### 4.2 Profile and privacy module

Public product data is separated from private personal data:

- The public profile stores display name and account state.
- The private profile vault stores application-managed personal fields as authenticated ciphertext with a key version.
- Supabase Auth retains the login email required by the authentication service; the application does not duplicate the email as plaintext in its own tables.
- Deterministic HMAC search keys support exact administrative lookup without exposing the underlying personal value.

Application encryption uses a versioned server-only key provider and authenticated encryption. Decryption is available only through narrow server-side use cases that enforce authorization and emit a privacy-access audit event. Encryption keys are never stored in the application database or browser bundle.

### 4.3 Authorization module

Every protected operation is checked at three boundaries:

1. Route or Server Action rejects unauthenticated and inactive accounts.
2. Domain authorization resolves the required service or room capability.
3. PostgreSQL RLS or a security-definer RPC enforces the same ownership and membership boundary.

Administrative service-role claims are not trusted solely from client-provided JWT metadata. The server resolves current assignments from protected data, and every state-changing administrative action records actor, target, reason, request ID, and result.

### 4.4 Invitation module

Invitation URLs carry a high-entropy opaque token. The database stores only a cryptographic hash of that token. An invitation includes room, grant role, expiry, maximum use count, current use count, status, creator, revocation reason, and replacement relationship.

Preview access reveals only room name, description, inviter display name, grant role, and expiry. Schedules, members, addresses, customer phone numbers, and operational notes remain hidden until successful authenticated redemption.

Redemption runs in one database transaction that locks the invitation row, rechecks status, expiry, use count, account state, and existing membership, creates membership once, increments the count once, and records the attempt. Reissuing an invitation revokes the prior invitation before returning the replacement token.

### 4.5 Administration and inquiry module

The PC-first administration application provides user, room, report, sanction, inquiry, audit, and IP-block views. Query and mutation endpoints use service-role capabilities rather than a single administrator flag.

Support inquiries have `open`, `in_progress`, `answered`, and `closed` states. Users can access only their own inquiries. Support staff must claim or be assigned an inquiry before reading its personal content. First access, assignment, reply, state change, and closure are audited. In-app notifications cover new and aging inquiries; outbound email is isolated behind an optional delivery adapter.

### 4.6 Security gateway

A shared rate-limit service runs before protected API handlers. Its store must provide atomic counters and block state shared across all application instances. The initial adapter uses a central transactional store and exposes an interface that permits migration to a Redis-compatible service without changing policies.

Client IP resolution accepts only explicitly configured headers from a trusted deployment proxy. Arbitrary `X-Forwarded-For` values are ignored when the request did not arrive through the configured proxy path. IP values and account identifiers are HMAC-pseudonymized before durable security logging.

### 4.7 Audit and operations module

Audit events are append-only and include event type, actor type and identifier, target type and identifier, request ID, timestamp, result, reason code, and redacted metadata. Application roles cannot update or delete audit events. Secrets, raw tokens, passwords, message bodies, phone numbers, addresses, and decrypted personal values are excluded from logs.

## 5. Authentication and Account Flows

### 5.1 Registration

1. The user begins email registration or one of the three social flows.
2. The service verifies the email or OAuth callback and creates an identity-bound account in `pending_profile`.
3. The user accepts required terms and supplies the minimum profile data and date of birth.
4. The application calculates whether the user is under 14 at the time of submission.
5. Users aged 14 or older become `active` after all required checks pass.
6. Users under 14 become `pending_guardian_consent`. The service collects only the minimum guardian contact data required to request consent.
7. An external mobile identity-verification adapter confirms the legal guardian and records consent scope, policy versions, timestamp, and evidence reference.
8. Verified consent activates the child account. Rejection, expiry, or unverifiable consent leaves the account inactive and triggers deletion of guardian contact data that is no longer necessary.

The legal guardian can request access, correction, deletion, processing suspension, or consent withdrawal for the child account. Withdrawal immediately restricts the account while deletion policy is applied.

### 5.2 Login and session control

- Login responses do not reveal whether an account exists.
- Login limits are evaluated by both IP key and HMAC account key.
- Access tokens are short-lived; refresh tokens rotate through Supabase Auth.
- Application session policy requires authentication again after seven days of inactivity or 30 days of absolute age.
- Password, private-profile, account-link, ownership, and service-role changes require authentication within the previous ten minutes.
- Password recovery and successful password change revoke all existing sessions.
- Suspended, deletion-pending, and guardian-pending accounts cannot enter room or schedule routes; each state receives only the limited account, privacy, consent, and support access defined in Section 3.1.

## 6. Room Visibility and Invitation Flows

Room visibility supports:

- `private`: only current room members can resolve room metadata.
- `invite_preview`: a valid invitation can resolve the minimal preview fields defined above.

There is no fully public room mode. Link access is rate-limited, logged, and never establishes room access without authentication and atomic redemption. Duplicate redemption by an existing member is idempotent and does not consume another use. Revoked, expired, exhausted, malformed, and replaced invitations return stable reason codes without revealing protected room content.

## 7. Inquiry, Report, and Sanction Flows

- An authenticated user in an allowed account state creates an inquiry with category, subject, and body. Active users may submit general inquiries; guardian-pending, restricted, and suspended users may submit only account, consent, privacy, or appeal inquiries.
- The service records an in-app administrative notification without copying the inquiry body into notification or log metadata.
- A support administrator claims the inquiry, causing the first authorized content access to be audited.
- Replies and status transitions are immutable history entries; corrections are new entries rather than destructive edits.
- Users receive in-app notification of replies and can close answered inquiries.
- Operations administrators receive reports, apply account or room restrictions with a required reason and duration, and may release them with a new audit event.
- Sanctions never delete the underlying evidence automatically. Evidence follows its declared retention basis and access scope.

## 8. Request Throttling and IP Blocking

### 8.1 General API policy

- Window: 60 seconds per IP
- Requests 1–90: no policy delay
- Requests 91–120: each request receives a random delay from one to three seconds
- Requests above 120: HTTP `429 Too Many Requests` with `Retry-After`
- If the IP exceeds the hard limit three times within ten minutes, the IP is blocked for 15 minutes

### 8.2 Sensitive policy

Login, password change, password recovery initiation, and invitation-code validation use a separate limit of 20 attempts per IP in five minutes. Login evaluates the same limit independently for the IP key and account key; exceeding either key blocks the attempt.

### 8.3 Operational policy

- Limit decisions are atomic across application instances.
- Delay, rejection, block, automatic release, and manual release are recorded as security events.
- A blocked response contains no protected account or room details.
- Thresholds are configuration values with the stated numbers as defaults.
- Operations staff review false positives and real usage before changing defaults.

## 9. Privacy, Retention, and Deletion

### 9.1 Data minimization

The service collects only data needed for authentication, age handling, scheduling, room collaboration, support, security, and legal obligations. Optional social profile fields, provider tokens, and unrelated demographic attributes are not retained.

### 9.2 Retention defaults

| Data category | Retention rule |
|---|---|
| Active account and room data | While the account or room remains active and the purpose persists |
| Deletion-pending account | Access revoked immediately; seven-day withdrawal period |
| Personal application data after withdrawal period | Delete or irreversibly de-identify |
| Support inquiries | Three years after closure |
| Audit and personal-data access logs | One year |
| Raw rate-limit and IP security events | 90 days |
| De-identified aggregate security metrics | Retained without a user or IP link |
| Backups | Daily rotation, maximum 35 days |

If a legal retention basis requires a different period, the service records the category, legal basis, start, end, and access restriction and retains only the required subset. Production launch requires Korean privacy counsel to confirm consent language, processor disclosures, and retention periods.

### 9.3 Deletion procedure

Withdrawal immediately revokes product access and sessions. At the end of the seven-day period, the deletion worker removes or de-identifies personal application data, resolves owned-room disposition safely, deletes identity links, and records a non-identifying completion event. Restore procedures rerun deletion tombstones so expired personal data is not reintroduced from backup. Backup copies disappear through the maximum 35-day rotation.

## 10. Security Requirements

- Passwords are handled only by Supabase Auth and stored using its one-way password-hashing controls.
- All production transport uses HTTPS with secure cookies.
- Session cookies are `HttpOnly`, `Secure` in production, and `SameSite=Lax`, which permits top-level OAuth callback navigation without allowing cookies on cross-site subrequests.
- Application-managed personal data uses authenticated encryption and versioned keys.
- Key material is held outside the database, separated by environment, and accessible only to server-side encryption operations.
- Key rotation writes new data with the current key and supports controlled re-encryption of older ciphertext.
- Every non-GET browser mutation requires a same-origin `Origin` and `Host` match. Any cookie-authenticated mutation route that cannot guarantee that check additionally requires a double-submit CSRF token.
- Redirect targets are selected from an allowlist.
- Authorization failures are fail-closed and return minimal error details.
- Critical mutations roll back when required authorization, encryption, or audit persistence fails.
- Idempotency keys protect retryable sensitive mutations.

## 11. Error and Recovery Design

Errors use stable, non-sensitive reason codes and user-facing recovery guidance. Authentication uses a common invalid-credentials response. Invitation errors distinguish user-actionable expired, revoked, exhausted, and already-member states without disclosing private room data. Rate-limit responses include `Retry-After`.

User input remains available after recoverable asynchronous failures. External OAuth and guardian-verification errors return users to a safe continuation screen. Critical partial writes are prevented by transactions. Background deletion, notification, and re-encryption jobs are idempotent and retry with bounded attempts; terminal failure creates an operational alert without logging protected payloads.

## 12. Testing Strategy

### 12.1 Unit tests

- Capability matrices for every service and room role
- Account-state gates and age-at-date calculation
- Invitation token generation, hashing, status, and reason mapping
- Retention and deletion eligibility
- Rate-limit delay, rejection, repeat-excess, and block-expiry decisions
- Redaction, HMAC pseudonymization, and encryption envelopes

### 12.2 Integration tests

- Email and OAuth callback state transitions
- Explicit identity linking after recent reauthentication
- Guardian-consent adapter contract and inactive-account enforcement
- RLS isolation across users, rooms, inquiries, and service roles
- Atomic invitation redemption at the final allowed use
- Concurrent schedule updates and conflict responses
- Admin restriction, release, and audit persistence
- Distributed rate-limit store atomicity
- Encryption key-version reads and re-encryption

### 12.3 End-to-end tests

- Email registration, verification, login, recovery, and global session revocation
- Provider-flow contracts for Google, Kakao, and Naver; live staging verification when credentials exist
- Under-14 pending state and guardian-consent completion through the test adapter
- Invitation preview, authentication, redemption, and room access
- Inquiry creation, assignment, reply, notification, and closure
- Report, sanction, release, and read-only audit review

### 12.4 Security and privacy tests

- Cross-user and cross-room direct-object-reference attempts
- Service-role escalation and administrative endpoint bypass
- Session fixation, CSRF, XSS, open redirect, and account enumeration
- Forged forwarded-IP headers and distributed limit bypass attempts
- Reuse of expired, revoked, exhausted, and replaced invitations
- Plaintext personal data in logs, errors, analytics, and audit metadata
- Key rotation, consent withdrawal, retention expiry, and backup deletion replay

New behavior follows strict red-green-refactor development. Changed production behavior must first have a focused failing test. Changed code maintains at least 80 percent line and function coverage. Full unit tests, type checking, linting, production build, and applicable browser verification must complete before handoff.

## 13. Accessibility and Compatibility

- User flows support widths from 360 pixels through desktop layouts.
- The administrator interface prioritizes desktop widths of 1280 pixels and above while retaining core tablet usability.
- All interactive functions are keyboard operable with visible focus and correctly associated labels and errors.
- Color contrast and interaction semantics target WCAG 2.2 AA.
- Core flows are verified on current Chrome, Edge, Safari, and Samsung Internet targets.
- Browser targets not executed directly are reported as unverified rather than passed.

## 14. Monitoring, Backup, and Incident Response

Structured logs correlate request, audit, and administrative events through a request ID after redaction. Alerts cover authentication-failure spikes, increased `429` responses, unusual authorization denials, critical background-job failure, and elevated API error rate.

Targets are:

- Monthly availability: 99.9 percent
- General API latency excluding intentional throttling: p95 at or below 500 milliseconds
- Recovery point objective: 24 hours
- Recovery time objective: four hours

Database backups run daily with a maximum 35-day rotation. Encryption keys and database backups are stored separately. A restore drill runs quarterly in an isolated environment and records result, duration, gaps, and remediation. Incident procedure covers detection, containment, impact analysis, recovery, required notification, and post-incident review.

## 15. External Dependencies and Activation

Production activation requires:

- Google Custom OIDC credentials, minimal scopes, email-optional configuration, and allowed callbacks
- Kakao Custom OIDC credentials, minimal scopes, email-optional configuration, and allowed callbacks
- Naver Custom OAuth2 application approval, credentials, minimal profile consent, email-optional configuration, and allowed callbacks
- A Korean mobile identity-verification provider contract and credentials for legal-guardian verification
- A server-side encryption key provider with environment-separated access control
- Production backup, monitoring, alert delivery, and trusted-proxy configuration

The repository implements adapters, environment validation, callbacks, safe disabled states, and test doubles. A provider without valid credentials remains disabled and is reported as not live-verified.

## 16. Implementation Sequence

1. Introduce domain capability, account-state, privacy envelope, and rate-policy units with failing tests.
2. Add schema migrations for separated profiles, role assignments, guardian consent, invitations, inquiries, sanctions, audit, and security state after explicit migration approval.
3. Add RLS and transactional RPC coverage before exposing new application routes.
4. Replace the administrator boolean with scoped service-role checks while preserving the initial administrator path.
5. Implement email and social authentication, account completion, recovery, reauthentication, and provider-disabled states.
6. Implement child-account pending and guardian-verification adapter flows.
7. Implement invitation creation, preview, revocation, replacement, and redemption.
8. Implement the PC-first administration and support inquiry interfaces.
9. Apply general and sensitive request policies to all relevant routes.
10. Add deletion, re-encryption, notification, monitoring, backup, and restore procedures.
11. Run focused, full, security, concurrency, accessibility, compatibility, and recovery verification and record any external validation gaps.

## 17. Success Criteria

- No automated authorization test obtains another user's protected room, schedule, inquiry, or personal data.
- All three social providers have implemented callback and disabled-state handling; enabled providers pass live staging verification before being described as available.
- Under-14 accounts cannot access protected service data before verified guardian consent.
- Concurrent redemption cannot exceed invitation maximum use count or create duplicate membership.
- The configured general and sensitive rate policies produce the specified delay, rejection, repeat-excess, and block behavior across application instances.
- Every personal-data read, administrative mutation, invitation redemption, and IP block transition produces an authorized redacted audit event.
- Withdrawal revokes access immediately and the deletion process meets the declared application and backup windows.
- Changed code meets the 80 percent line and function coverage threshold, and full typecheck, lint, build, and supported automated tests pass.
- Direct browser and restore-drill results distinguish verified targets from documented but unverified targets.
