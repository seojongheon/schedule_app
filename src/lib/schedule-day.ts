export function isScheduleOverlappingDay(
  startAt: string,
  endAt: string,
  referenceDate: Date = new Date(),
) {
  const dayStart = new Date(referenceDate);
  dayStart.setHours(0, 0, 0, 0);

  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);

  return new Date(startAt) < nextDayStart && new Date(endAt) > dayStart;
}
