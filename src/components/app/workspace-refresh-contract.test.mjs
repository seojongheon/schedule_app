import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceUrl = new URL('./ScheduleWorkspace.tsx', import.meta.url);
const actionsUrl = new URL('../../app/actions/schedule-actions.ts', import.meta.url);

test('workspace mutations keep local UI state without requesting a full route refresh', async () => {
  const source = await readFile(workspaceUrl, 'utf8');

  assert.doesNotMatch(source, /router\.refresh\(\)/);
});

test('schedule mutations do not invalidate every workspace route', async () => {
  const source = await readFile(actionsUrl, 'utf8');

  assert.doesNotMatch(source, /revalidateApp/);
  assert.doesNotMatch(source, /revalidatePath/);
  assert.doesNotMatch(source, /next\/cache/);
});
