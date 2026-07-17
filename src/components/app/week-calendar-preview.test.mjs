import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWeekSchedulePreview } from './week-calendar-preview.ts';

test('shows at most two schedules and reports the remaining count', () => {
  const cases = [
    { total: 0, visible: 0, hidden: 0 },
    { total: 1, visible: 1, hidden: 0 },
    { total: 2, visible: 2, hidden: 0 },
    { total: 3, visible: 2, hidden: 1 },
    { total: 8, visible: 2, hidden: 6 },
    { total: 100, visible: 2, hidden: 98 },
  ];

  for (const expectation of cases) {
    const schedules = Array.from({ length: expectation.total }, (_, index) => ({ id: index }));
    const preview = buildWeekSchedulePreview(schedules);

    assert.equal(preview.visibleSchedules.length, expectation.visible);
    assert.equal(preview.hiddenCount, expectation.hidden);
    assert.deepEqual(preview.visibleSchedules, schedules.slice(0, 2));
  }
});

test('does not mutate the source schedule array', () => {
  const schedules = Object.freeze([{ id: 1 }, { id: 2 }, { id: 3 }]);

  buildWeekSchedulePreview(schedules);

  assert.deepEqual(schedules, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});
