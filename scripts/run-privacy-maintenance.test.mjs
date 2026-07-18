import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseMaintenanceMode,
  runDeletionMaintenance,
  runReencryptionMaintenance,
  runRestoreReconciliation,
} from './run-privacy-maintenance.mjs';

test('maintenance mode is explicit and rejects unknown work', () => {
  assert.equal(parseMaintenanceMode(['deletion']), 'deletion');
  assert.equal(parseMaintenanceMode(['retention']), 'retention');
  assert.throws(() => parseMaintenanceMode([]), /mode/i);
  assert.throws(() => parseMaintenanceMode(['all']), /mode/i);
});

test('deletion maintenance finalizes due subjects once and reports individual failures', async () => {
  const finalized = [];
  const result = await runDeletionMaintenance({
    listDue: async () => [
      { userId: 'user-1', subjectKey: 'subject-1' },
      { userId: 'user-2', subjectKey: 'subject-2' },
    ],
    finalize: async (row) => {
      if (row.userId === 'user-2') throw new Error('transient');
      finalized.push(row.subjectKey);
    },
  }, new Date('2026-07-25T12:00:00Z'));
  assert.deepEqual(finalized, ['subject-1']);
  assert.deepEqual(result, { processed: 1, failed: 1 });
});

test('re-encryption only receives stale records and is idempotent when none remain', async () => {
  const rotated = [];
  const dependencies = {
    listStale: async (activeVersion) => activeVersion === 2 ? [{ userId: 'user-1', keyVersion: 1 }] : [],
    rotate: async (row) => { rotated.push(row.userId); },
  };
  assert.deepEqual(await runReencryptionMaintenance(dependencies, 2), { processed: 1, failed: 0 });
  assert.deepEqual(rotated, ['user-1']);
});

test('restore reconciliation quarantines only completed deletion subjects that reappear', async () => {
  const quarantined = [];
  const result = await runRestoreReconciliation({
    listCompletedSubjects: async () => ['a', 'b'],
    listRestoredSubjects: async () => ['b', 'c'],
    quarantine: async (subject) => { quarantined.push(subject); },
  });
  assert.deepEqual(quarantined, ['b']);
  assert.deepEqual(result, { processed: 1, failed: 0 });
});
