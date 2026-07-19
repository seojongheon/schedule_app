import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('./schedule-supabase.ts', import.meta.url);

test('workspace data queries select explicit columns instead of wildcard payloads', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.doesNotMatch(source, /\.select\('\*'\)/);
  assert.match(source, /ROOM_COLUMNS/);
  assert.match(source, /SCHEDULE_COLUMNS/);
  assert.match(source, /buildScheduleWorkspaceQueryPlan/);
});

test('today queries use Korea Standard Time boundaries', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /getKoreanDayBounds/);
  assert.match(source, /\.lt\('start_at', dayBounds\.endAt\)/);
  assert.match(source, /\.gt\('end_at', dayBounds\.startAt\)/);
});
