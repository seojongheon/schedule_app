export const WEEK_SCHEDULE_PREVIEW_LIMIT = 2;

export function buildWeekSchedulePreview<T>(schedules: readonly T[]) {
  return {
    visibleSchedules: schedules.slice(0, WEEK_SCHEDULE_PREVIEW_LIMIT),
    hiddenCount: Math.max(schedules.length - WEEK_SCHEDULE_PREVIEW_LIMIT, 0),
  };
}
