import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const calendarUrl = new URL('./ScheduleCalendar.tsx', import.meta.url);

test('daily timetable renders calculated lanes and a filter-aware complete overflow list', async () => {
  const source = await readFile(calendarUrl, 'utf8');

  assert.match(source, /buildScheduleOverlapLayout/);
  assert.match(source, /hiddenSchedules\.some/);
  assert.match(source, /scheduleIds\.map/);
  assert.match(source, /겹친 일정 전체 보기/);
  assert.match(source, /참여자/);
  assert.match(source, /onScheduleClick\(schedule\)/);
  assert.match(source, /h-\[1344px\]/);
  assert.doesNotMatch(source, /index % 2/);
  assert.doesNotMatch(source, /min-w-\[142px\]/);
});
