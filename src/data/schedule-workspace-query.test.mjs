import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduleWorkspaceQueryPlan } from './schedule-workspace-query.ts';

test('assigns the smallest required schedule workspace query plan to each page', () => {
  assert.deepEqual(buildScheduleWorkspaceQueryPlan({ page: 'dashboard' }), {
    includeSchedules: 'all',
    includeParticipants: true,
    includeStates: true,
    includeTasks: true,
    includePreference: false,
  });
  assert.deepEqual(buildScheduleWorkspaceQueryPlan({ page: 'todayTasks' }), {
    includeSchedules: 'today',
    includeParticipants: true,
    includeStates: true,
    includeTasks: true,
    includePreference: false,
  });
  assert.deepEqual(buildScheduleWorkspaceQueryPlan({ page: 'preliminaryTasks' }), {
    includeSchedules: 'none',
    includeParticipants: false,
    includeStates: false,
    includeTasks: true,
    includePreference: false,
  });
  assert.deepEqual(buildScheduleWorkspaceQueryPlan({ page: 'rooms' }), {
    includeSchedules: 'none',
    includeParticipants: false,
    includeStates: false,
    includeTasks: false,
    includePreference: false,
  });
  assert.deepEqual(buildScheduleWorkspaceQueryPlan({ page: 'room', roomId: 'room-1' }), {
    includeSchedules: 'room',
    includeParticipants: true,
    includeStates: true,
    includeTasks: false,
    includePreference: false,
    roomId: 'room-1',
  });
  assert.deepEqual(buildScheduleWorkspaceQueryPlan({ page: 'mypage' }), {
    includeSchedules: 'none',
    includeParticipants: false,
    includeStates: false,
    includeTasks: false,
    includePreference: true,
  });
});

test('rejects a room workspace request without a room identifier', () => {
  assert.throws(() => buildScheduleWorkspaceQueryPlan({ page: 'room' }), /roomId/);
});
