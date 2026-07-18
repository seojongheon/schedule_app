# Incident Response

## Severity

- Critical: personal-data exposure, credential or key compromise, unauthorized administrative action, deleted-data replay, or broad authentication failure.
- High: sustained rate-control bypass, deletion or backup job failure, or scoped administrative access failure.
- Medium: isolated provider failure, elevated application errors, or inquiry-processing delay.

## Response sequence

1. Acknowledge the alert and assign an incident commander and recorder.
2. Preserve request IDs, bounded error codes, deployment version, timestamps, and redacted audit events. Do not copy tokens, message bodies, emails, phone numbers, or raw IP addresses.
3. Contain the affected path using provider flags, account or room restriction, IP block, key rotation, or deployment rollback as appropriate.
4. Confirm authorization boundaries and determine affected subjects from protected systems with least-privilege access.
5. Recover from a known-good release or backup and run deletion replay reconciliation before reopening traffic.
6. Document impact, decisions, notification obligations, corrective actions, owners, and due dates.

## Security key compromise

Rotate the compromised key in the secret manager, invalidate sessions when authentication material may be affected, run re-encryption where applicable, revoke the old key only after verification, and review audit events under dual control.

## Closure criteria

Service health is stable, unauthorized access is contained, required privacy processing is current, monitoring is active, evidence is preserved, and follow-up work has owners and deadlines.

## Readiness evidence

The runbook is documentation-only until an isolated exercise records participants, timestamps, alerts, containment actions, recovery duration, notification decisions, and remediation owners.
