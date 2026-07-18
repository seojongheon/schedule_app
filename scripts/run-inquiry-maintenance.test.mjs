import assert from 'node:assert/strict';
import test from 'node:test';

import { parseInquiryMaintenanceMode, runAgingNotificationMaintenance } from './run-inquiry-maintenance.mjs';

test('aging is the only supported inquiry maintenance mode', () => {
  assert.equal(parseInquiryMaintenanceMode(['aging']), 'aging');
  assert.throws(() => parseInquiryMaintenanceMode(['unknown']), /valid inquiry maintenance mode/i);
});

test('aging maintenance delegates one idempotent queue transaction with its cutoff', async () => {
  const calls = [];
  const now = new Date('2026-07-18T03:00:00.000Z');
  const result = await runAgingNotificationMaintenance({
    enqueue: async (cutoff) => { calls.push(cutoff.toISOString()); return 4; },
  }, now, 24);

  assert.deepEqual(calls, ['2026-07-17T03:00:00.000Z']);
  assert.deepEqual(result, { queued: 4 });
});
