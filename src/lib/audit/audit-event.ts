export const AUDIT_RESULTS = ["success", "denied", "failure"] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

type AuditParty = { type: string; id: string };
type MetadataPrimitive = string | number | boolean;
export type AuditMetadata = Record<string, MetadataPrimitive>;

const ALLOWED_METADATA_KEYS = new Set([
  "operation",
  "scope",
  "status",
  "count",
  "role",
  "provider",
  "category",
  "enabled",
]);

const SENSITIVE_NAME = /(password|secret|token|session|cookie|phone|email|address|body|content|plaintext|ciphertext)/i;
const SAFE_NAME = /^[a-z][a-z0-9_.-]{1,99}$/;

export type AuditEventInput = {
  eventType: string;
  actor: AuditParty;
  target: AuditParty;
  requestId: string;
  occurredAt?: Date;
  result: string;
  reasonCode: string;
  metadata?: Record<string, unknown>;
};

export type AuditEvent = {
  eventType: string;
  actorType: string;
  actorId: string;
  targetType: string;
  targetId: string;
  requestId: string;
  occurredAt: string;
  result: AuditResult;
  reasonCode: string;
  metadata: AuditMetadata;
};

function requireIdentifier(value: string, label: string): string {
  if (!value || value.length > 200) throw new Error(`${label} is required and must be bounded.`);
  return value;
}

export function redactAuditMetadata(metadata: Record<string, unknown> = {}): AuditMetadata {
  const safe: AuditMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_NAME.test(key) || !ALLOWED_METADATA_KEYS.has(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 200);
    else if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean") safe[key] = value;
  }

  return safe;
}

export function buildAuditEvent(input: AuditEventInput): AuditEvent {
  if (!SAFE_NAME.test(input.eventType) || SENSITIVE_NAME.test(input.eventType)) {
    throw new Error("Invalid audit event type.");
  }
  if (!AUDIT_RESULTS.includes(input.result as AuditResult)) {
    throw new Error("Invalid audit result.");
  }

  const occurredAt = input.occurredAt ?? new Date();
  if (!Number.isFinite(occurredAt.getTime())) throw new Error("Invalid audit event time.");

  return {
    eventType: input.eventType,
    actorType: requireIdentifier(input.actor.type, "Actor type"),
    actorId: requireIdentifier(input.actor.id, "Actor ID"),
    targetType: requireIdentifier(input.target.type, "Target type"),
    targetId: requireIdentifier(input.target.id, "Target ID"),
    requestId: requireIdentifier(input.requestId, "Request ID"),
    occurredAt: occurredAt.toISOString(),
    result: input.result as AuditResult,
    reasonCode: requireIdentifier(input.reasonCode, "Reason code"),
    metadata: redactAuditMetadata(input.metadata),
  };
}
