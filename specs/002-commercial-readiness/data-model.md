# Data Model: Commercial Readiness Foundation

## Conventions

- All identifiers are UUIDs unless explicitly described as hashes.
- Timestamps are UTC `timestamptz` values.
- Mutable rows include `created_at` and `updated_at`; history rows are append-only.
- User and IP lookup values stored in security history are HMAC pseudonyms, not raw input.
- Private ciphertext records include `ciphertext`, `iv`, `auth_tag`, and `key_version` fields.
- Every exposed table has RLS enabled before application access is granted.

## Account and Privacy Entities

### profiles

Public service profile and account lifecycle.

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key; references authenticated identity |
| display_name | text | 1–80 normalized characters |
| account_state | text | One of the account states below |
| is_under_14 | boolean | Derived at profile completion; not a birth date |
| terms_version | text | Required before activation |
| privacy_version | text | Required before activation |
| terms_accepted_at | timestamptz | Required before activation |
| privacy_accepted_at | timestamptz | Required before activation |
| session_started_at | timestamptz | Start of current application session family |
| last_seen_at | timestamptz | Used for seven-day inactivity policy |
| last_reauthenticated_at | timestamptz | Used for ten-minute sensitive-action policy |
| deletion_requested_at | timestamptz | Null until withdrawal |
| deletion_due_at | timestamptz | Seven days after accepted withdrawal |
| created_at | timestamptz | Immutable |
| updated_at | timestamptz | Trigger maintained |

Account state transitions:

```text
pending_email_verification -> pending_profile
pending_profile -> active
pending_profile -> pending_guardian_consent
pending_guardian_consent -> active
active -> restricted -> active
active|restricted -> suspended -> active|restricted
active|restricted|suspended -> deletion_pending -> deleted
pending_guardian_consent -> deletion_pending -> deleted
```

Only dedicated server operations may change `account_state`. `deleted` is terminal.

### private_profiles

Application-managed private fields, one row per profile.

| Field | Type | Rules |
|---|---|---|
| user_id | uuid | Primary key; references profiles |
| phone_ciphertext | text | Nullable encrypted normalized phone |
| phone_iv | text | Base64url; present with phone ciphertext |
| phone_auth_tag | text | Base64url; present with phone ciphertext |
| phone_lookup_hash | text | Nullable unique HMAC for exact lookup |
| birth_date_ciphertext | text | Required after profile completion |
| birth_date_iv | text | Base64url |
| birth_date_auth_tag | text | Base64url |
| key_version | integer | Positive version resolved outside database |
| created_at | timestamptz | Immutable |
| updated_at | timestamptz | Trigger maintained |

Only service-role server repositories can read ciphertext. Decryption additionally requires a capability decision and creates a privacy access event.

### account_email_references

Exact-match application email lookup without duplicating Auth email plaintext.

| Field | Type | Rules |
|---|---|---|
| user_id | uuid | Primary key; references profiles |
| email_lookup_hash | text | Unique normalized HMAC |
| verified_at | timestamptz | Separate service email verification time |
| created_at | timestamptz | Immutable |
| updated_at | timestamptz | Trigger maintained |

### guardian_consents

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| child_user_id | uuid | References profiles; one current pending/approved record |
| status | text | pending, approved, rejected, expired, withdrawn |
| guardian_name_ciphertext envelope | text fields | Nullable after rejection/expiry cleanup |
| guardian_phone_ciphertext envelope | text fields | Nullable after rejection/expiry cleanup |
| guardian_phone_lookup_hash | text | Nullable HMAC |
| provider | text | Adapter identifier, never a credential |
| evidence_reference | text | Opaque provider evidence identifier |
| terms_version | text | Consent scope version |
| privacy_version | text | Consent scope version |
| requested_at | timestamptz | Required |
| verified_at | timestamptz | Required for approved |
| expires_at | timestamptz | Required for pending request |
| withdrawn_at | timestamptz | Required for withdrawn |
| created_at | timestamptz | Immutable |
| updated_at | timestamptz | Trigger maintained |

## Authorization Entities

### service_role_assignments

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | References profiles |
| role | text | super_admin, operations_admin, support_admin, auditor |
| granted_by_user_id | uuid | References profiles |
| granted_at | timestamptz | Required |
| revoked_by_user_id | uuid | Nullable |
| revoked_at | timestamptz | Nullable |
| reason | text | Required for grant and revoke audit |

Unique active `(user_id, role)` assignment. At least one active super administrator must remain.

### room_members changes

The role constraint expands from owner, manager, member to owner, manager, member, viewer. Viewer policies deny schedule and task mutation.

### scheduling_rooms changes

| New field | Type | Rules |
|---|---|---|
| visibility | text | private or invite_preview; default private |
| restriction_state | text | active or restricted |
| restricted_until | timestamptz | Nullable |

## Invitation Entities

### room_invites changes

| Field | Type | Rules |
|---|---|---|
| id | uuid | Existing primary key |
| room_id | uuid | Existing room reference |
| token_hash | text | Unique, required for new invitations |
| token_hint | text | Last non-secret display characters only |
| grant_role | text | member or viewer |
| status | text | active, revoked, expired, exhausted, replaced |
| expires_at | timestamptz | Required; bounded by policy |
| max_uses | integer | Required; >= 1 |
| used_count | integer | 0..max_uses |
| created_by_user_id | uuid | Existing creator |
| revoked_by_user_id | uuid | Nullable |
| revoked_at | timestamptz | Nullable |
| revocation_reason | text | Nullable; required when revoked |
| replacement_invite_id | uuid | Nullable self-reference |
| created_at | timestamptz | Existing |

Legacy plaintext `code` values are migrated to hashes, then replaced with a non-secret compatibility value until the column can be removed in a later deployment.

### invitation_attempts

Append-only validation and redemption record.

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| invite_id | uuid | Nullable when token is unknown |
| actor_user_id | uuid | Nullable before authentication |
| ip_key | text | HMAC pseudonym |
| event_type | text | preview, validate, redeem, deny |
| result_code | text | Stable non-sensitive outcome |
| request_id | text | Correlation identifier |
| occurred_at | timestamptz | Immutable |

## Support and Administration Entities

### support_inquiries

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Requesting profile |
| category | text | general, account, consent, privacy, appeal |
| subject | text | 1–160 characters |
| body_ciphertext envelope | text fields | Encrypted inquiry content |
| key_version | integer | Required |
| status | text | open, in_progress, answered, closed |
| assigned_to_user_id | uuid | Nullable support/super admin |
| created_at | timestamptz | Immutable |
| updated_at | timestamptz | Trigger maintained |
| closed_at | timestamptz | Required when closed |
| retention_until | timestamptz | Three years after closure |

### support_inquiry_messages

Append-only encrypted replies.

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| inquiry_id | uuid | References support inquiry |
| author_user_id | uuid | User or authorized support actor |
| author_kind | text | user or admin |
| body_ciphertext envelope | text fields | Encrypted content |
| key_version | integer | Required |
| created_at | timestamptz | Immutable |

### admin_notifications

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| audience_role | text | support_admin, operations_admin, super_admin |
| type | text | new_inquiry, aging_inquiry, security_alert, job_failure |
| target_type | text | Non-sensitive target kind |
| target_id | uuid | Target identifier |
| read_by_user_ids | uuid[] | No private content |
| created_at | timestamptz | Immutable |

### reports

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| reporter_user_id | uuid | References profiles |
| target_type | text | account or room |
| target_id | uuid | Target identifier |
| reason_code | text | Required |
| detail_ciphertext envelope | text fields | Optional encrypted evidence text |
| status | text | open, investigating, resolved, dismissed |
| assigned_to_user_id | uuid | Nullable operations/super admin |
| created_at | timestamptz | Immutable |
| resolved_at | timestamptz | Nullable |

### sanctions

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| target_type | text | account or room |
| target_id | uuid | Target identifier |
| sanction_type | text | restrict or suspend |
| reason | text | Required |
| starts_at | timestamptz | Required |
| ends_at | timestamptz | Nullable |
| imposed_by_user_id | uuid | Operations/super admin |
| released_by_user_id | uuid | Nullable |
| released_at | timestamptz | Nullable |
| release_reason | text | Required on release |

## Audit, Request Control, and Deletion Entities

### audit_events

Append-only and unavailable for client writes.

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| event_type | text | Controlled vocabulary |
| actor_type | text | user, admin, system, anonymous |
| actor_key | text | UUID or HMAC pseudonym |
| target_type | text | Controlled vocabulary |
| target_key | text | UUID or non-sensitive key |
| result | text | success or denied or failure |
| reason_code | text | Stable code |
| request_id | text | Correlation value |
| metadata | jsonb | Redacted allowlisted values only |
| occurred_at | timestamptz | Immutable |
| retention_until | timestamptz | One year by default |

### rate_limit_counters

Short-lived transactional state.

| Field | Type | Rules |
|---|---|---|
| scope | text | general_ip, sensitive_ip, login_account |
| subject_key | text | HMAC pseudonym |
| window_started_at | timestamptz | Fixed window start |
| request_count | integer | Atomic increment |
| updated_at | timestamptz | Required |

Primary key `(scope, subject_key, window_started_at)`.

### rate_limit_violations

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| subject_key | text | IP HMAC |
| policy | text | general or sensitive |
| occurred_at | timestamptz | Used for ten-minute repeat count |
| request_id | text | Correlation value |
| retention_until | timestamptz | 90 days |

### ip_blocks

| Field | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| ip_key | text | HMAC pseudonym |
| blocked_at | timestamptz | Required |
| blocked_until | timestamptz | 15 minutes for automatic block |
| source | text | automatic or manual |
| reason | text | Required |
| released_by_user_id | uuid | Nullable |
| released_at | timestamptz | Nullable |
| release_reason | text | Required on manual release |

### deletion_records

Durable non-identifying restore reconciliation marker.

| Field | Type | Rules |
|---|---|---|
| subject_key | text | HMAC of former user ID with deletion-specific key |
| requested_at | timestamptz | Required |
| due_at | timestamptz | Required |
| completed_at | timestamptz | Nullable until completed |
| replayed_at | timestamptz | Last restore reconciliation |
| result_code | text | No personal value |

## Transaction Boundaries

### redeem_room_invite

Locks the invitation row, resolves status and time, rejects inactive accounts, detects existing membership, inserts membership once, increments count once, marks exhaustion, inserts invitation attempt and audit event, and returns a stable result.

### apply_admin_sanction / release_admin_sanction

Checks current service capability, writes sanction history, updates account or room state, records the audit event, and refuses a partial update.

### evaluate_request_limit

Checks active blocks, increments the correct counter, inserts a violation on hard excess, counts violations within ten minutes, creates a 15-minute block on the third violation, and returns allow, delay, reject, or block with retry seconds.

### append_audit_event

Accepts only a controlled event type, stable result and reason code, correlation values, and allowlisted metadata keys. Application roles cannot mutate inserted rows.

