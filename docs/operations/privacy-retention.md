# Privacy Retention and Deletion Operations

## Scheduled jobs

Run each mode separately with a server-only service key and `PRIVACY_MAINTENANCE_SECRET`:

```sh
node scripts/run-privacy-maintenance.mjs deletion
node scripts/run-privacy-maintenance.mjs retention
node scripts/run-privacy-maintenance.mjs reencrypt
node scripts/run-privacy-maintenance.mjs reconcile
```

Recommended schedule: deletion hourly, retention daily, re-encryption during an approved key-rotation window, and reconciliation immediately after every restore.

## Withdrawal lifecycle

Withdrawal changes the account to `deletion_pending`, revokes product access and sessions, and records a deadline seven days later. A recently reauthenticated user can cancel before the deadline unless irreversible deletion has begun. The deletion job removes private profiles, email lookup references, guardian evidence, and inquiry content; de-identifies retained account and membership references; pseudonymizes retained audit references; and records completion without plaintext personal data.

## Retention cleanup

The cleanup job removes expired audit events, rate-limit violations, inactive counters, and inquiries whose declared retention deadline has passed. Legal holds must be represented by extending the applicable retention deadline through an approved administrative procedure before cleanup runs.

## Key rotation

1. Add the new 256-bit base64 key as `PRIVATE_DATA_KEY_Vn` while retaining every historical key still referenced by data.
2. Set `PRIVATE_DATA_ACTIVE_KEY_VERSION` to the new version and deploy.
3. Run `reencrypt` until it reports zero stale records.
4. Verify decrypt, tamper rejection, audit evidence, and backup restore in an isolated environment.
5. Remove an old key only after the database and all retained backups no longer reference it.

Job output contains mode and aggregate counts only. A nonzero failed count is an operational failure and must alert the on-call operator.

## Readiness evidence

Unit tests verify job orchestration and cryptographic behavior. Production readiness additionally requires execution against an isolated restored database, review of deletion and audit rows, and confirmation that scheduled job and alert delivery are configured. Documentation alone is not execution evidence.
