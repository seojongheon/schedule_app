export type RoomRole = 'owner' | 'manager' | 'member' | 'viewer';
export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';
export type AccountStatus = 'active' | 'inactive';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isServiceAdmin: boolean;
  status: AccountStatus;
  lastLoginAt: string | null;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  nickname: string;
  role: RoomRole;
  color: string;
  joinedAt: string;
  lastActiveAt: string | null;
  email: string;
  name: string;
}

export interface SchedulingRoom {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sharedScheduleColor: string;
  ownerUserId: string;
  status: 'active' | 'archived';
  defaultView: 'week' | 'month';
  businessStartTime: string;
  businessEndTime: string;
  members: RoomMember[];
  todayScheduleCount: number;
  nextSchedule: string | null;
  recentActivity: string;
}

export interface Schedule {
  id: string;
  roomId: string;
  title: string;
  startAt: string;
  endAt: string;
  address: string | null;
  customerPhone: string | null;
  estimatedPrice: number | null;
  additionalInfo: string | null;
  status: ScheduleStatus;
  createdByMemberId: string;
  updatedAt: string;
  participantMemberIds: string[];
  isChecked?: boolean;
}

export interface PreliminaryTask {
  id: string;
  userId: string;
  roomId: string | null;
  title: string;
  memo: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  isCompleted: boolean;
}

export interface UserPreference {
  userId: string;
  pushEnabled: boolean;
  defaultCalendarView: 'week' | 'month';
  filterOpacity: number;
}
