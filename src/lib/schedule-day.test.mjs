import assert from 'node:assert/strict';
import test from 'node:test';
import { countSchedulesOverlappingDay, getKoreanDayBounds, isScheduleOverlappingDay } from './schedule-day.ts';

const today = new Date(2026, 6, 18, 12, 0, 0);

test('includes schedules that overlap any part of the local calendar day', () => {
  assert.equal(isScheduleOverlappingDay('2026-07-18T09:00:00+09:00', '2026-07-18T10:00:00+09:00', today), true);
  assert.equal(isScheduleOverlappingDay('2026-07-17T23:00:00+09:00', '2026-07-18T01:00:00+09:00', today), true);
  assert.equal(isScheduleOverlappingDay('2026-07-18T23:00:00+09:00', '2026-07-19T01:00:00+09:00', today), true);
});

test('excludes schedules that only touch, but do not overlap, the day boundary', () => {
  assert.equal(isScheduleOverlappingDay('2026-07-17T22:00:00+09:00', '2026-07-18T00:00:00+09:00', today), false);
  assert.equal(isScheduleOverlappingDay('2026-07-19T00:00:00+09:00', '2026-07-19T01:00:00+09:00', today), false);
});

test('counts only schedules that overlap today', () => {
  const schedules = [
    { startAt: '2026-07-18T09:00:00+09:00', endAt: '2026-07-18T10:00:00+09:00' },
    { startAt: '2026-07-18T23:00:00+09:00', endAt: '2026-07-19T01:00:00+09:00' },
    { startAt: '2026-07-20T09:00:00+09:00', endAt: '2026-07-20T10:00:00+09:00' },
  ];

  assert.equal(countSchedulesOverlappingDay(schedules, today), 2);
});

test('uses Korea Standard Time boundaries independently from the server timezone', () => {
  const bounds = getKoreanDayBounds(new Date('2026-07-18T20:00:00.000Z'));

  assert.deepEqual(bounds, {
    startAt: '2026-07-18T15:00:00.000Z',
    endAt: '2026-07-19T15:00:00.000Z',
  });
});
