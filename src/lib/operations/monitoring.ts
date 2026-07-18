const EVENT_TYPES = new Set([
  'auth_provider_failed',
  'privacy_job_failed',
  'rate_limit_blocked',
  'backup_restore_replay',
  'database_unavailable',
  'inquiry_queue_aging',
]);
const SEVERITIES = new Set(['info', 'warning', 'critical']);
const SAFE_DIMENSION = /^[a-zA-Z0-9._:-]{1,100}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export type OperationalEvent = {
  type: string;
  severity: string;
  operation: string;
  requestId: string;
  errorCode?: string;
  count?: number;
  [key: string]: unknown;
};

export type RedactedOperationalEvent = {
  type: string;
  severity: string;
  operation: string;
  requestId: string;
  errorCode?: string;
  count?: number;
};

export function redactOperationalEvent(input: OperationalEvent): RedactedOperationalEvent {
  if (!EVENT_TYPES.has(input.type)) throw new Error('Operational event type is not allowed.');
  if (!SEVERITIES.has(input.severity)) throw new Error('Operational severity is not allowed.');
  if (!SAFE_DIMENSION.test(input.operation)) throw new Error('Operational dimension is invalid.');
  if (!SAFE_REQUEST_ID.test(input.requestId)) throw new Error('Operational request ID is invalid.');
  if (input.errorCode !== undefined && !SAFE_DIMENSION.test(input.errorCode)) throw new Error('Operational error code is invalid.');
  if (input.count !== undefined && (!Number.isInteger(input.count) || input.count < 0)) throw new Error('Operational count is invalid.');
  return {
    type: input.type,
    severity: input.severity,
    operation: input.operation,
    requestId: input.requestId,
    ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    ...(input.count === undefined ? {} : { count: input.count }),
  };
}

export function createMonitoringAdapter(sink: {
  emit(event: RedactedOperationalEvent): Promise<void>;
  alert(event: RedactedOperationalEvent): Promise<void>;
}) {
  return {
    async capture(input: OperationalEvent) {
      const event = redactOperationalEvent(input);
      await sink.emit(event);
      if (event.severity === 'critical') await sink.alert(event);
    },
  };
}
