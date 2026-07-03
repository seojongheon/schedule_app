import type { AccountStatus, RoomRole, ScheduleStatus, TaskPriority } from '@/domain/entities';

export const roomRoleLabels: Record<RoomRole, string> = {
  owner: '방장',
  manager: '매니저',
  member: '참여자',
};

export const scheduleStatusLabels: Record<ScheduleStatus, string> = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
};

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: '활성',
  inactive: '비활성',
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: '낮음',
  normal: '보통',
  high: '높음',
};
