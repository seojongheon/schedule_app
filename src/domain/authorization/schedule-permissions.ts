import type { RoomRole } from '@/domain/entities';

export function canCreateSchedule(role?: RoomRole) {
  return role === 'owner' || role === 'manager' || role === 'member';
}

export function canAssignScheduleOwner(
  actorRole: RoomRole | undefined,
  actorMemberId: string,
  targetMemberId: string,
  targetRole: RoomRole,
) {
  if (targetRole === 'viewer') {
    return false;
  }

  if (actorRole === 'owner' || actorRole === 'manager') {
    return true;
  }

  return actorRole === 'member' && actorMemberId === targetMemberId;
}

export function canEditSchedule(actorMemberId: string, ownerMemberId: string) {
  return actorMemberId === ownerMemberId;
}

export function canDeleteSchedule(
  actorRole: RoomRole | undefined,
  actorMemberId: string,
  ownerMemberId: string,
  ownerRole: RoomRole | undefined,
) {
  return actorMemberId === ownerMemberId
    || ((actorRole === 'owner' || actorRole === 'manager') && ownerRole === 'member');
}

export function canManageMembership(role?: RoomRole) {
  return role === 'owner';
}
