# Backup and Restore

## Backup requirements

- Encrypt backups with a key managed separately from application data keys.
- Restrict backup and restore roles, require strong authentication, and record every operation.
- Rotate backup generations out within 35 days and verify that expired copies are deleted from primary and replicated storage.
- Test restore procedures on an isolated project on a documented schedule.

## Restore procedure

1. Declare an incident or approved recovery exercise and record the recovery point and responsible operators.
2. Restore into an isolated environment with outbound notifications and provider callbacks disabled.
3. Apply every schema migration required by the restored application release.
4. Run integrity, row-level authorization, encryption-tamper, and account-state checks.
5. Run `node scripts/run-privacy-maintenance.mjs reconcile` before any user traffic. Completed deletion subjects that reappear must be quarantined and deleted again.
6. Confirm retention cleanup, key availability, audit continuity, and room ownership consistency.
7. Promote the restored system only after an independent operator approves the evidence.

## Recovery objectives

Recovery point and recovery time objectives are deployment decisions and must be recorded before production launch. A successful restore test records actual duration, data gap, failed checks, corrective actions, and the next exercise date.

## Readiness evidence

Repository tests and this procedure do not prove that hosted backups can be restored. Direct evidence requires a completed isolated restore, deletion reconciliation, measured recovery point and recovery time, and independent approval before traffic is enabled.
