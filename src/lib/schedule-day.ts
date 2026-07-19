const koreanDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getKoreanDayBounds(referenceDate: Date = new Date()) {
  const parts = koreanDateFormatter.formatToParts(referenceDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = values.year;
  const month = values.month;
  const day = values.day;
  const dayStart = new Date(`${year}-${month}-${day}T00:00:00+09:00`);
  const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  return {
    startAt: dayStart.toISOString(),
    endAt: nextDayStart.toISOString(),
  };
}

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

export function countSchedulesOverlappingDay(
  schedules: Array<{ startAt: string; endAt: string }>,
  referenceDate: Date = new Date(),
) {
  return schedules.filter((schedule) =>
    isScheduleOverlappingDay(schedule.startAt, schedule.endAt, referenceDate),
  ).length;
}
