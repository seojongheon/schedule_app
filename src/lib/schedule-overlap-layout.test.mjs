import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduleOverlapLayout } from './schedule-overlap-layout.ts';

function input(id, startMinute, endMinute, createdAt) {
  return { id, startMinute, endMinute, createdAt };
}

function position(segment) {
  return {
    scheduleId: segment.scheduleId,
    startMinute: segment.startMinute,
    endMinute: segment.endMinute,
    columnIndex: segment.columnIndex,
    columnCount: segment.columnCount,
  };
}

test('orders overlapping schedules from left to right by actual creation time', () => {
  const result = buildScheduleOverlapLayout([
    input('new', 540, 660, '2026-07-20T10:00:00Z'),
    input('old', 540, 660, '2026-07-20T09:00:00Z'),
    input('middle', 540, 660, '2026-07-20T09:30:00Z'),
  ]);

  assert.deepEqual(result.scheduleSegments.map(position), [
    { scheduleId: 'old', startMinute: 540, endMinute: 660, columnIndex: 0, columnCount: 3 },
    { scheduleId: 'middle', startMinute: 540, endMinute: 660, columnIndex: 1, columnCount: 3 },
    { scheduleId: 'new', startMinute: 540, endMinute: 660, columnIndex: 2, columnCount: 3 },
  ]);
});

test('keeps non-overlapping and exact-boundary schedules at full width', () => {
  const result = buildScheduleOverlapLayout([
    input('first', 540, 600, '2026-07-20T09:00:00Z'),
    input('second', 600, 660, '2026-07-20T10:00:00Z'),
    input('third', 720, 780, '2026-07-20T11:00:00Z'),
  ]);

  assert.deepEqual(result.scheduleSegments.map(position), [
    { scheduleId: 'first', startMinute: 540, endMinute: 600, columnIndex: 0, columnCount: 1 },
    { scheduleId: 'second', startMinute: 600, endMinute: 660, columnIndex: 0, columnCount: 1 },
    { scheduleId: 'third', startMinute: 720, endMinute: 780, columnIndex: 0, columnCount: 1 },
  ]);
});

test('shrinks and expands an existing schedule only across the actual overlap band', () => {
  const result = buildScheduleOverlapLayout([
    input('old', 540, 720, '2026-07-20T09:00:00Z'),
    input('new', 600, 660, '2026-07-20T10:00:00Z'),
  ]);

  assert.deepEqual(result.scheduleSegments.map(position), [
    { scheduleId: 'old', startMinute: 540, endMinute: 600, columnIndex: 0, columnCount: 1 },
    { scheduleId: 'old', startMinute: 600, endMinute: 660, columnIndex: 0, columnCount: 2 },
    { scheduleId: 'new', startMinute: 600, endMinute: 660, columnIndex: 1, columnCount: 2 },
    { scheduleId: 'old', startMinute: 660, endMinute: 720, columnIndex: 0, columnCount: 1 },
  ]);
});

test('uses the schedule id as a stable tie breaker for equal creation times', () => {
  const createdAt = '2026-07-20T09:00:00Z';
  const result = buildScheduleOverlapLayout([
    input('b', 540, 600, createdAt),
    input('a', 540, 600, createdAt),
  ]);

  assert.deepEqual(result.scheduleSegments.map((segment) => segment.scheduleId), ['a', 'b']);
});

test('collapses only a five-way simultaneous band into three schedules and one overflow segment', () => {
  const result = buildScheduleOverlapLayout([
    input('one', 540, 720, '2026-07-20T09:00:00Z'),
    input('two', 540, 720, '2026-07-20T09:10:00Z'),
    input('three', 540, 720, '2026-07-20T09:20:00Z'),
    input('four', 540, 720, '2026-07-20T09:30:00Z'),
    input('five', 600, 660, '2026-07-20T09:40:00Z'),
  ]);

  assert.deepEqual(result.overflowSegments, [
    {
      kind: 'overflow',
      id: 'overflow-600-660-one-two-three-four-five',
      startMinute: 600,
      endMinute: 660,
      columnIndex: 3,
      columnCount: 4,
      scheduleIds: ['one', 'two', 'three', 'four', 'five'],
      hiddenScheduleIds: ['four', 'five'],
    },
  ]);
  assert.deepEqual(
    result.scheduleSegments.filter((segment) => ['one', 'two', 'three'].includes(segment.scheduleId)).map(position),
    [
      { scheduleId: 'one', startMinute: 540, endMinute: 720, columnIndex: 0, columnCount: 4 },
      { scheduleId: 'two', startMinute: 540, endMinute: 720, columnIndex: 1, columnCount: 4 },
      { scheduleId: 'three', startMinute: 540, endMinute: 720, columnIndex: 2, columnCount: 4 },
    ],
  );
});

test('does not collapse five chained schedules when no time band has five active schedules', () => {
  const result = buildScheduleOverlapLayout([
    input('one', 540, 600, '2026-07-20T09:00:00Z'),
    input('two', 570, 630, '2026-07-20T09:10:00Z'),
    input('three', 600, 660, '2026-07-20T09:20:00Z'),
    input('four', 630, 690, '2026-07-20T09:30:00Z'),
    input('five', 660, 720, '2026-07-20T09:40:00Z'),
  ]);

  assert.equal(result.overflowSegments.length, 0);
  assert.deepEqual(
    [...new Set(result.scheduleSegments.map((segment) => segment.scheduleId))].sort(),
    ['five', 'four', 'one', 'three', 'two'],
  );
  assert.equal(Math.max(...result.scheduleSegments.map((segment) => segment.columnCount)), 2);
});
