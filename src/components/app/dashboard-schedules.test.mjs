import assert from 'node:assert/strict';
import test from 'node:test';
import { getSchedulesAssignedToProfile } from '../../lib/dashboard-schedules.ts';

const rooms = [
  {
    id: 'room-clean',
    members: [
      { id: 'member-minsu', userId: 'user-minsu' },
      { id: 'member-jihyun', userId: 'user-jihyun' },
    ],
  },
];

test('keeps a future schedule assigned to the current profile for the dashboard calendar', () => {
  const schedules = [
    {
      id: 'august-assigned',
      roomId: 'room-clean',
      participantMemberIds: ['member-minsu'],
    },
    {
      id: 'august-other-member',
      roomId: 'room-clean',
      participantMemberIds: ['member-jihyun'],
    },
  ];

  const assigned = getSchedulesAssignedToProfile(schedules, rooms, 'user-minsu');

  assert.deepEqual(assigned.map((schedule) => schedule.id), ['august-assigned']);
});
