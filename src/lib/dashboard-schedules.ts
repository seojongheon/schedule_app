import type { Schedule, SchedulingRoom } from '@/domain/entities';

export function getSchedulesAssignedToProfile(
  schedules: Schedule[],
  rooms: SchedulingRoom[],
  profileId: string,
) {
  return schedules.filter((schedule) => {
    const room = rooms.find((candidate) => candidate.id === schedule.roomId);
    const member = room?.members.find((candidate) => candidate.userId === profileId);

    return Boolean(member && schedule.participantMemberIds.includes(member.id));
  });
}
