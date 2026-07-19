export type ScheduleWorkspacePage = 'dashboard' | 'todayTasks' | 'preliminaryTasks' | 'rooms' | 'room' | 'mypage';

export type ScheduleWorkspaceRequest = {
  page: ScheduleWorkspacePage;
  roomId?: string;
};

export type WorkspaceQueryPlan = {
  includeSchedules: 'all' | 'today' | 'room' | 'none';
  includeParticipants: boolean;
  includeStates: boolean;
  includeTasks: boolean;
  includePreference: boolean;
  roomId?: string;
};

export function buildScheduleWorkspaceQueryPlan(request: ScheduleWorkspaceRequest): WorkspaceQueryPlan {
  switch (request.page) {
    case 'dashboard':
      return { includeSchedules: 'all', includeParticipants: true, includeStates: true, includeTasks: true, includePreference: false };
    case 'todayTasks':
      return { includeSchedules: 'today', includeParticipants: true, includeStates: true, includeTasks: true, includePreference: false };
    case 'preliminaryTasks':
      return { includeSchedules: 'none', includeParticipants: false, includeStates: false, includeTasks: true, includePreference: false };
    case 'rooms':
      return { includeSchedules: 'none', includeParticipants: false, includeStates: false, includeTasks: false, includePreference: false };
    case 'room':
      if (!request.roomId) throw new Error('room workspace requests require a roomId');
      return {
        includeSchedules: 'room',
        includeParticipants: true,
        includeStates: true,
        includeTasks: false,
        includePreference: false,
        roomId: request.roomId,
      };
    case 'mypage':
      return { includeSchedules: 'none', includeParticipants: false, includeStates: false, includeTasks: false, includePreference: true };
  }
}
