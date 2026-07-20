import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canAssignScheduleOwner,
  canCreateSchedule,
  canDeleteSchedule,
  canEditSchedule,
  canManageMembership,
} from './schedule-permissions.ts';

test('members create and edit only their own schedules', () => {
  assert.equal(canCreateSchedule('member'), true);
  assert.equal(canAssignScheduleOwner('member', 'member-a', 'member-a', 'member'), true);
  assert.equal(canAssignScheduleOwner('member', 'member-a', 'member-b', 'member'), false);
  assert.equal(canEditSchedule('member-a', 'member-a'), true);
  assert.equal(canEditSchedule('member-a', 'member-b'), false);
});

test('owners and managers assign eligible owners but cannot delete peer schedules', () => {
  for (const role of ['owner', 'manager']) {
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'owner'), true);
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'manager'), true);
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'member'), true);
    assert.equal(canAssignScheduleOwner(role, 'actor', 'target', 'viewer'), false);
    assert.equal(canDeleteSchedule(role, 'actor', 'target', 'member'), true);
    assert.equal(canDeleteSchedule(role, 'actor', 'target', 'manager'), false);
    assert.equal(canDeleteSchedule(role, 'actor', 'target', 'owner'), false);
    assert.equal(canDeleteSchedule(role, 'actor', 'actor', role), true);
  }
});

test('only owners manage membership and viewers remain read only', () => {
  assert.equal(canManageMembership('owner'), true);
  assert.equal(canManageMembership('manager'), false);
  assert.equal(canManageMembership('member'), false);
  assert.equal(canCreateSchedule('viewer'), false);
});
