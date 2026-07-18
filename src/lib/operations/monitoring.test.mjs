import assert from 'node:assert/strict';
import test from 'node:test';

import { createMonitoringAdapter, redactOperationalEvent } from './monitoring.ts';

test('operational events keep allowlisted metadata and remove personal or secret values', () => {
  const event = redactOperationalEvent({
    type: 'privacy_job_failed', severity: 'critical', operation: 'deletion', requestId: 'req-12345678',
    errorCode: 'DATABASE_TIMEOUT', message: 'user@example.com token=secret', email: 'user@example.com',
    rawIp: '203.0.113.1', count: 2,
  });
  assert.deepEqual(event, {
    type: 'privacy_job_failed', severity: 'critical', operation: 'deletion',
    requestId: 'req-12345678', errorCode: 'DATABASE_TIMEOUT', count: 2,
  });
  assert.equal(JSON.stringify(event).includes('user@example.com'), false);
  assert.equal(JSON.stringify(event).includes('203.0.113.1'), false);
});

test('monitoring adapter emits redacted events and escalates defined critical conditions', async () => {
  const emitted = [];
  const alerted = [];
  const adapter = createMonitoringAdapter({
    emit: async (event) => { emitted.push(event); },
    alert: async (event) => { alerted.push(event); },
  });
  await adapter.capture({ type: 'auth_provider_failed', severity: 'warning', operation: 'google', requestId: 'req-12345678', message: 'secret' });
  await adapter.capture({ type: 'backup_restore_replay', severity: 'critical', operation: 'reconcile', requestId: 'req-87654321' });
  assert.equal(emitted.length, 2);
  assert.equal(alerted.length, 1);
  assert.equal('message' in emitted[0], false);
});

test('invalid event dimensions fail closed instead of becoming unbounded logs', () => {
  assert.throws(() => redactOperationalEvent({ type: 'unknown', severity: 'warning', operation: 'x', requestId: 'req-12345678' }), /event type/i);
  assert.throws(() => redactOperationalEvent({ type: 'privacy_job_failed', severity: 'loud', operation: 'x', requestId: 'req-12345678' }), /severity/i);
});
