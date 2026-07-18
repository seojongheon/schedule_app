# Feature Specification: Commercial Readiness Foundation

**Feature Branch**: `002-commercial-readiness`

**Created**: 2026-07-18

**Status**: Approved

**Input**: User description: "Prepare the shared scheduling service for unrestricted public use with multi-user security, self-service and social authentication, secure invitation links, role-separated administration, support inquiries, privacy controls, abuse prevention, and operational verification."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and Recover a Secure Account (Priority: P1)

A person can create an account using email or Google, Kakao, or Naver, complete required consent and profile steps, sign in safely, recover access, and explicitly connect additional sign-in methods without risking automatic account takeover.

**Why this priority**: Public access is impossible until people can create, verify, secure, and recover their own accounts.

**Independent Test**: Create separate accounts through each supported method, verify account-state gates, recover an email account, and connect a social identity only after recent authentication.

**Acceptance Scenarios**:

1. **Given** a new adult user, **When** the user verifies an email address or completes an enabled social sign-in and accepts required terms, **Then** the user can activate an account and enter authorized service areas.
2. **Given** an account under age 14, **When** required profile data is submitted, **Then** protected service access remains unavailable until verified legal-guardian consent is recorded.
3. **Given** an existing account and a social identity with the same email, **When** the social sign-in is attempted without prior account authentication, **Then** the identities are not merged automatically.
4. **Given** an authenticated account, **When** the user reauthenticates and chooses to connect a social identity, **Then** the identity is connected and the action is recorded.
5. **Given** a forgotten password, **When** the user completes the valid recovery flow, **Then** the password changes and all prior sessions are revoked.
6. **Given** an unknown or suspended account, **When** login fails, **Then** the response does not reveal whether the account exists.

---

### User Story 2 - Join a Room Through a Controlled Invitation (Priority: P1)

A room owner or manager can issue a limited invitation, and a recipient can preview minimal room information and join with the intended role only while the invitation remains valid.

**Why this priority**: Room participation is the primary collaboration path and must resist link leakage, replay, overuse, and privilege escalation.

**Independent Test**: Issue invitations with different expiry and use limits, redeem them concurrently, revoke and replace them, and confirm that no recipient receives a role above the link grant.

**Acceptance Scenarios**:

1. **Given** an authorized room owner or manager, **When** an invitation is created, **Then** the creator can set expiry, maximum uses, and either member or viewer access.
2. **Given** a valid invitation, **When** an unauthenticated recipient opens it, **Then** only the approved preview fields are shown.
3. **Given** a valid invitation and an active account, **When** the recipient joins, **Then** membership is created once and the use count increases once.
4. **Given** the last available invitation use, **When** two recipients attempt to redeem it at the same time, **Then** only one redemption succeeds.
5. **Given** a revoked, expired, exhausted, malformed, or replaced invitation, **When** it is opened or redeemed, **Then** access is denied without exposing protected room content.
6. **Given** an existing member, **When** the same invitation is redeemed again, **Then** the result is idempotent and no additional use is consumed.

---

### User Story 3 - Request and Receive Private Support (Priority: P2)

An authenticated user can submit an inquiry, see its status and replies, and close it, while support personnel access only the inquiries and personal content required for their work.

**Why this priority**: Public users need a controlled path for account, consent, privacy, and service problems.

**Independent Test**: Submit inquiries from active and limited account states, assign and answer them as support staff, and verify cross-user and unauthorized administrator denial.

**Acceptance Scenarios**:

1. **Given** an active account, **When** the user submits an inquiry, **Then** it appears as open and creates an administrator notification without duplicating the body.
2. **Given** a guardian-pending, restricted, or suspended account, **When** the user submits an account, consent, privacy, or appeal inquiry, **Then** the inquiry is accepted while unrelated product actions remain blocked.
3. **Given** an unassigned inquiry, **When** authorized support staff claim it, **Then** content access and assignment are recorded.
4. **Given** another user's inquiry, **When** a user or unauthorized administrator requests it, **Then** access is denied.
5. **Given** an answered inquiry, **When** the user closes it, **Then** the full state and reply history remains available according to retention policy.

---

### User Story 4 - Operate Users and Rooms with Scoped Administration (Priority: P2)

Service administrators can manage users, rooms, reports, sanctions, inquiries, security blocks, and operating history according to separate job roles from a desktop-oriented workspace.

**Why this priority**: Commercial operations require accountable intervention without granting every staff member unrestricted access.

**Independent Test**: Assign each administrator role and verify its allowed and denied screens, data fields, and actions across users, rooms, inquiries, sanctions, audit events, and IP blocks.

**Acceptance Scenarios**:

1. **Given** a super administrator, **When** service roles are assigned or removed, **Then** the new authorization applies immediately and is recorded.
2. **Given** an operations administrator, **When** a user or room restriction is applied with a reason and duration, **Then** access changes immediately and the action can later be released through a separate recorded event.
3. **Given** a support administrator, **When** user or inquiry information is requested, **Then** only support-scoped information is available.
4. **Given** an auditor, **When** operating history is reviewed, **Then** records are read-only and personal content is masked.
5. **Given** any service administrator without room membership, **When** a room schedule is requested outside an authorized investigation workflow, **Then** access is denied.

---

### User Story 5 - Resist Abusive and Abnormal Requests (Priority: P2)

Legitimate users can continue normal use while repeated high-volume or sensitive requests are delayed, rejected, and temporarily blocked according to transparent, reviewable rules.

**Why this priority**: Public endpoints introduce brute-force, enumeration, invitation probing, and resource-exhaustion risk.

**Independent Test**: Generate requests below, within, and above each threshold from multiple application instances and verify delay, rejection, repeat-excess, block, and release behavior.

**Acceptance Scenarios**:

1. **Given** one IP making general requests, **When** its count exceeds 90 but not 120 within 60 seconds, **Then** each subsequent request is delayed by one to three seconds.
2. **Given** one IP exceeding 120 general requests within 60 seconds, **When** another request arrives, **Then** it receives a 429 response and retry guidance.
3. **Given** one IP exceeding the hard limit three times within ten minutes, **When** the third excess is recorded, **Then** the IP is blocked for 15 minutes.
4. **Given** login, password-change, recovery-initiation, or invitation-validation attempts, **When** one IP exceeds 20 attempts within five minutes, **Then** further attempts are rejected for the window.
5. **Given** a login attempt, **When** either the IP limit or account limit is exceeded, **Then** the attempt is rejected without disclosing account existence.
6. **Given** an untrusted forwarded-IP header, **When** a request is evaluated, **Then** the untrusted value cannot change the rate-limit identity.

---

### User Story 6 - Exercise Privacy Rights and Recover Operations (Priority: P3)

Users and legal guardians can inspect, correct, delete, or withdraw consent for personal data, while operators can audit access, restore service, and verify that expired personal data is not reintroduced.

**Why this priority**: Commercial readiness requires lifecycle controls and recoverability in addition to working product features.

**Independent Test**: Perform personal-data access and deletion requests, rotate encryption keys, restore a backup in isolation, replay deletion records, and verify privacy, audit, and recovery outcomes.

**Acceptance Scenarios**:

1. **Given** an authenticated user or verified guardian, **When** an authorized personal-data request is made, **Then** the requested action and every staff access are recorded.
2. **Given** a withdrawal request, **When** it is accepted, **Then** sessions and product access are revoked immediately.
3. **Given** the end of the seven-day withdrawal period, **When** deletion processing runs, **Then** personal application data is deleted or irreversibly de-identified except for documented legal retention.
4. **Given** encrypted personal data written under an older key version, **When** key rotation is performed, **Then** authorized reads and controlled re-encryption continue without exposing plaintext.
5. **Given** a database restore, **When** deletion records are replayed, **Then** expired personal data does not return to active use.
6. **Given** a quarterly recovery exercise, **When** an isolated restore is completed, **Then** recovery time, data-loss window, gaps, and remediation are recorded.

### Edge Cases

- A social provider returns no email or the user declines an optional profile field.
- A callback is replayed, has an invalid state value, or points to an unapproved redirect.
- A child becomes 14 while guardian consent is pending or after consent has been recorded.
- A guardian rejects, withdraws, or never completes consent.
- An owner requests account deletion while still owning active rooms.
- A manager attempts to issue an owner or manager invitation.
- An invitation is revoked while a redemption transaction is in progress.
- A room is restricted while members have active sessions.
- A support administrator loses the support role while viewing an inquiry.
- A personal-data decrypt or audit write fails during a sensitive mutation.
- Two administrators apply conflicting sanctions at the same time.
- An IP block expires while a request is in flight.
- A trusted proxy sends multiple addresses or an invalid address value.
- A backup contains data whose deletion deadline passed after the backup was created.
- A supported browser lacks an optional capability or an external provider is not configured.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity and Accounts

- **FR-001**: The service MUST allow self-service registration using verified email and password.
- **FR-002**: The service MUST offer Google, Kakao, and Naver sign-in when the corresponding provider is enabled.
- **FR-003**: The service MUST show a safe unavailable state for a provider that is not configured or approved.
- **FR-004**: The service MUST NOT merge identities solely because email values match.
- **FR-005**: The service MUST require recent reauthentication before connecting or disconnecting a sign-in identity.
- **FR-006**: The service MUST support password recovery through a short-lived, single-use method and revoke prior sessions after success.
- **FR-007**: The service MUST enforce account states that separate unverified, profile-incomplete, guardian-pending, active, restricted, suspended, deletion-pending, and deleted users.
- **FR-008**: The service MUST prevent login and recovery responses from revealing whether an account exists.
- **FR-009**: The service MUST expire application sessions after seven days of inactivity or 30 days of absolute age.
- **FR-010**: The service MUST require authentication within the previous ten minutes for password, private-profile, identity-link, room-ownership, and service-role changes.

#### Children and Consent

- **FR-011**: The service MUST permit users of any age to begin registration.
- **FR-012**: The service MUST prevent users under 14 from protected room and schedule access until verified legal-guardian consent is recorded.
- **FR-013**: The service MUST collect only the minimum guardian information needed to request and verify consent.
- **FR-014**: The service MUST support verified guardian consent, rejection, expiry, withdrawal, and personal-data rights requests.
- **FR-015**: The service MUST delete guardian contact data when it is no longer needed for a pending consent request.

#### Authorization and Rooms

- **FR-016**: The service MUST separate service administrator roles from room membership roles.
- **FR-017**: The service MUST support owner, manager, member, and viewer room roles with the approved capability matrix.
- **FR-018**: The service MUST support super administrator, operations administrator, support administrator, and auditor service roles with least-privilege access.
- **FR-019**: Every protected operation MUST enforce authentication, current account state, and required capability at all available authorization boundaries.
- **FR-020**: Holding a service role MUST NOT automatically grant room schedule or member-data access.
- **FR-021**: Room content MUST never be fully public; only members may read protected content.
- **FR-022**: A valid invitation preview MAY show only room name, description, inviter display name, grant role, and expiry.

#### Invitations

- **FR-023**: Authorized owners and managers MUST be able to issue invitations with expiry, maximum uses, and member or viewer grants.
- **FR-024**: Invitation secrets MUST NOT be retained in reusable plaintext form.
- **FR-025**: Invitation redemption MUST atomically recheck status, expiry, use count, account state, and existing membership.
- **FR-026**: Concurrent redemption MUST NOT exceed the maximum use count or create duplicate membership.
- **FR-027**: Authorized staff MUST be able to revoke and replace an invitation, and replacement MUST invalidate the prior invitation immediately.
- **FR-028**: The service MUST record invitation creation, validation outcome, redemption, revocation, replacement, and denial without recording the secret.

#### Support and Administration

- **FR-029**: Authenticated users MUST be able to create, view, and close inquiries allowed by their account state.
- **FR-030**: Inquiries MUST move through open, in-progress, answered, and closed states while preserving reply and transition history.
- **FR-031**: Inquiry personal content MUST be limited to the requesting user and assigned or claiming support personnel with explicit capability.
- **FR-032**: New and aging inquiries MUST produce administrator notifications that exclude the inquiry body and private values.
- **FR-033**: The desktop-oriented administration workspace MUST provide scoped views for users, rooms, reports, sanctions, inquiries, audit events, and IP blocks.
- **FR-034**: Account and room restrictions MUST require a reason and optional expiry and MUST support a separately recorded release action.
- **FR-035**: Administrative access, personal-data access, role changes, sanctions, inquiry actions, and security-block actions MUST produce append-only audit events.

#### Privacy and Security Data

- **FR-036**: Passwords MUST be stored only as non-reversible password verifiers managed by the authentication service.
- **FR-037**: Application-managed private personal fields MUST be encrypted at rest and protected in transit.
- **FR-038**: Encryption keys MUST be versioned, stored separately from protected data, and available only to authorized server-side operations.
- **FR-039**: The service MUST support key rotation and controlled re-encryption of older ciphertext.
- **FR-040**: Every authorized view, correction, deletion, and disclosure of private personal data MUST be recorded without copying the private value into the record.
- **FR-041**: Critical mutations MUST fail without partial state when authorization, required encryption, or audit persistence fails.
- **FR-042**: Logs, errors, notifications, and analytics MUST exclude passwords, raw session or invitation tokens, inquiry bodies, and decrypted private fields.

#### Retention and Recovery

- **FR-043**: Account withdrawal MUST revoke access and sessions immediately and allow a seven-day withdrawal period before final deletion.
- **FR-044**: After the withdrawal period, personal application data MUST be deleted or irreversibly de-identified unless a documented legal basis requires limited retention.
- **FR-045**: Closed inquiries MUST be retained for three years, audit and personal-access records for one year, and raw request-control events for 90 days.
- **FR-046**: Backups MUST rotate within 35 days, and restored data MUST be reconciled with deletion records before returning to service.
- **FR-047**: The service MUST maintain documented incident, backup, restore, and deletion-replay procedures.

#### Request Control

- **FR-048**: General requests from one IP MUST be allowed through 90 requests per 60 seconds without a policy delay.
- **FR-049**: General requests 91 through 120 within 60 seconds MUST each receive a random one-to-three-second delay.
- **FR-050**: General requests above 120 within 60 seconds MUST receive a 429 response with retry guidance.
- **FR-051**: An IP that exceeds the hard general limit three times within ten minutes MUST be blocked for 15 minutes.
- **FR-052**: Login, password change, password recovery initiation, and invitation validation MUST each share a sensitive limit of 20 attempts per IP within five minutes.
- **FR-053**: Login MUST enforce the sensitive limit independently for both IP and pseudonymized account identity.
- **FR-054**: The service MUST accept client-IP forwarding data only from explicitly trusted deployment proxies.
- **FR-055**: Delay, rejection, block, automatic release, and manual release MUST be recorded and reviewable.
- **FR-056**: Default request thresholds MUST be configurable so operations staff can adjust them after reviewing usage and false positives.

#### Quality and Operations

- **FR-057**: User-facing flows MUST work from 360-pixel mobile layouts through desktop layouts, and the administrator workspace MUST prioritize 1280-pixel desktop use.
- **FR-058**: Core flows MUST be keyboard operable and meet WCAG 2.2 AA contrast, focus, label, and error-association expectations.
- **FR-059**: Verification MUST cover current Chrome, Edge, Safari, and Samsung Internet, and MUST distinguish directly tested targets from reasoned compatibility.
- **FR-060**: The service MUST monitor authentication-failure spikes, request rejections, authorization-denial anomalies, critical background-job failures, and elevated error rate.
- **FR-061**: Recovery exercises MUST be performed quarterly in an isolated environment and record duration, data-loss window, gaps, and remediation.
- **FR-062**: Changes to user-visible behavior MUST be demonstrated by an automated test that fails before the behavior is implemented.

### Key Entities

- **Account**: A service identity with lifecycle state, consent completion, session policy, and sign-in identities.
- **Sign-in Identity**: An email or social identity connected to one account through explicit verification.
- **Public Profile**: Non-sensitive display information and current service state.
- **Private Profile**: Encrypted personal information, exact-match search references, and encryption-key version.
- **Guardian Consent**: A legal-guardian verification and consent record with scope, status, policy versions, evidence reference, and lifecycle dates.
- **Room**: A private collaboration space with an owner, visibility mode, operational state, and membership.
- **Room Membership**: The relationship between an account and room with owner, manager, member, or viewer role.
- **Invitation**: A revocable, expiring, limited-use grant to join a room as member or viewer.
- **Invitation Attempt**: A redacted record of preview, validation, redemption, and denial outcomes.
- **Service Role Assignment**: A scoped administrative role granted to an account with actor and lifecycle history.
- **Support Inquiry**: A private request with category, subject, content, status, owner, assignment, and immutable reply history.
- **Report and Sanction**: Operational evidence and a reasoned account or room restriction with release history.
- **Audit Event**: An append-only, redacted record of a sensitive or administrative action.
- **Request-Control Event**: A pseudonymized rate-limit decision, violation, block, or release record.
- **Deletion Record**: A durable non-identifying marker used to complete deletion and prevent restoration of expired data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of test participants can complete an enabled registration method and reach the correct account state without staff assistance in under five minutes.
- **SC-002**: 100% of automated cross-user, cross-room, cross-inquiry, and unauthorized-administrator access attempts are denied.
- **SC-003**: 100% of under-14 test accounts remain unable to access rooms and schedules before verified guardian consent.
- **SC-004**: In 1,000 concurrent final-use invitation trials, no invitation exceeds its maximum use count and no duplicate membership is created.
- **SC-005**: Request-control trials produce the specified delay, rejection, repeated-excess, 15-minute block, and release behavior with no inconsistent decision across application instances.
- **SC-006**: 100% of tested personal-data reads, administrative mutations, invitation redemptions, and IP block transitions create a redacted audit event.
- **SC-007**: Account withdrawal revokes user access within one minute and eligible personal application data is removed or de-identified within the declared deletion window.
- **SC-008**: Quarterly restore exercises meet a recovery point of 24 hours and recovery time of four hours, with deletion records reapplied before service use.
- **SC-009**: General user actions excluding deliberate request-control delay complete within 500 milliseconds at the 95th percentile under the agreed production-readiness load profile.
- **SC-010**: The service reaches 99.9% monthly availability after launch, excluding declared maintenance windows.
- **SC-011**: All critical user and administrator journeys are keyboard operable and have no WCAG 2.2 AA critical violations in automated and manual review.
- **SC-012**: Changed code maintains at least 80% line and function coverage, and all required quality checks pass before release.

## Assumptions

- The first launch serves users in the Republic of Korea.
- Registration is available without an age ceiling; users under 14 require verified legal-guardian consent.
- A Korean mobile identity-verification provider will be contracted before under-14 production activation.
- Existing room and schedule capabilities remain in place and are tightened through the new account, role, and privacy rules.
- Rooms are private; invitation holders may see only a minimal preview and there is no public schedule mode.
- Social provider credentials and approvals are deployment prerequisites and are never committed to source control.
- Provider integrations without valid credentials remain safely disabled and are not reported as live verified.
- Production consent language, processor disclosures, and retention periods receive Korean privacy counsel review before launch.
- External email delivery beyond authentication and in-app notifications is optional for this release.

