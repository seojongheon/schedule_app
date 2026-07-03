'use client';

import { addDays, addMonths, addWeeks, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Profile, Schedule, SchedulingRoom } from '@/domain/entities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ParticipantFilterChip } from '@/components/app/ParticipantFilterChip';
import { cn } from '@/lib/utils';

function minutesFromDayStart(dateValue: string) {
  const date = new Date(dateValue);
  return date.getHours() * 60 + date.getMinutes();
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function dateKey(dateValue: Date | string) {
  return format(new Date(dateValue), 'yyyy-MM-dd');
}

const weekdayLabels = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function buildFilterOptions(room: SchedulingRoom, currentUser: Profile) {
  const myMember = room.members.find((member) => member.userId === currentUser.id);
  return [
    { id: 'all', label: '전체' },
    { id: 'mine', label: '내 일정' },
    ...room.members.map((member) => ({ id: member.id, label: member.nickname })),
    { id: 'shared', label: '공동 일정' },
  ].filter((option, index, array) => option.id !== 'mine' || Boolean(myMember) || array[index]);
}

export function ScheduleCalendar({
  room,
  schedules,
  currentUser,
  onScheduleClick,
  compact = false,
  timeTableAction,
}: {
  room: SchedulingRoom;
  schedules: Schedule[];
  currentUser: Profile;
  onScheduleClick: (schedule: Schedule) => void;
  compact?: boolean;
  timeTableAction?: ReactNode;
}) {
  const [view, setView] = useState<'week' | 'month'>(room.defaultView);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes);
  const [calendarDate, setCalendarDate] = useState(() => new Date('2026-07-02T09:00:00+09:00'));
  const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKey(new Date('2026-07-02T09:00:00+09:00')));
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDayCount = differenceInCalendarDays(monthGridEnd, monthGridStart) + 1;
  const monthDays = Array.from({ length: monthDayCount }, (_, index) => addDays(monthGridStart, index));
  const todayKey = dateKey(new Date());
  const currentUserMember = room.members.find((member) => member.userId === currentUser.id);
  const filters = buildFilterOptions(room, currentUser);
  const dayStart = 0;
  const dayEnd = 24 * 60;
  const totalMinutes = dayEnd - dayStart;
  const currentTimeTop = ((currentMinutes - dayStart) / totalMinutes) * 100;
  const isCurrentTimeVisible = currentMinutes >= dayStart && currentMinutes < dayEnd;
  const headerTitle = view === 'month'
    ? format(calendarDate, 'yyyy년 M월')
    : `${format(weekStart, 'yyyy년 M월 d일')} - ${format(weekEnd, 'M월 d일')}`;

  const moveCalendar = (direction: -1 | 1) => {
    setCalendarDate((previous) => {
      const nextDate = view === 'month' ? addMonths(previous, direction) : addWeeks(previous, direction);

      if (view === 'week') {
        setSelectedDateKey(dateKey(startOfWeek(nextDate, { weekStartsOn: 1 })));
      }

      return nextDate;
    });
  };

  useEffect(() => {
    const updateCurrentTime = () => setCurrentMinutes(getCurrentMinutes());
    updateCurrentTime();

    const intervalId = window.setInterval(updateCurrentTime, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const hourRows = useMemo(() => {
    const rows: number[] = [];
    for (let minutes = dayStart; minutes <= dayEnd; minutes += 60) {
      rows.push(minutes);
    }
    return rows;
  }, [dayStart, dayEnd]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (schedule: Schedule) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    return schedule.title.toLowerCase().includes(normalizedSearchQuery);
  };

  const isHighlighted = (schedule: Schedule) => {
    if (!matchesSearch(schedule)) {
      return false;
    }

    if (selectedFilter === 'all') {
      return true;
    }

    if (selectedFilter === 'shared') {
      return schedule.participantMemberIds.length > 1;
    }

    if (selectedFilter === 'mine') {
      return currentUserMember ? schedule.participantMemberIds.includes(currentUserMember.id) : false;
    }

    return schedule.participantMemberIds.includes(selectedFilter);
  };

  const matchedScheduleCount = schedules.filter(matchesSearch).length;

  const schedulesByDate = useMemo(() => {
    return schedules.reduce<Record<string, Schedule[]>>((groups, schedule) => {
      const key = dateKey(schedule.startAt);
      groups[key] = [...(groups[key] ?? []), schedule];
      return groups;
    }, {});
  }, [schedules]);

  const weekDateKeys = useMemo(() => new Set(days.map((day) => dateKey(day))), [days]);
  const selectedDaySchedules = schedules.filter((schedule) => dateKey(schedule.startAt) === selectedDateKey);
  const selectedDate = new Date(`${selectedDateKey}T09:00:00+09:00`);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400">달력</p>
            <h2 className="text-xl font-black text-gray-950">{headerTitle}</h2>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={view === 'month' ? '이전 월' : '이전 주'}
              onClick={() => moveCalendar(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={isSearchOpen ? 'secondary' : 'outline'}
              size="icon"
              aria-label="일정 제목 검색"
              onClick={() => setIsSearchOpen((previous) => !previous)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={view === 'month' ? '다음 월' : '다음 주'}
              onClick={() => moveCalendar(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex rounded-2xl bg-gray-50 p-1">
          {(['week', 'month'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                'min-h-11 flex-1 rounded-xl text-sm font-bold',
                view === option ? 'bg-white text-app-blue shadow-sm' : 'text-gray-400',
              )}
              onClick={() => {
                setView(option);
                if (option === 'week') {
                  setSelectedDateKey(dateKey(calendarDate));
                }
              }}
            >
              {option === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>
        {isSearchOpen ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="일정 제목 검색"
                className="h-11 w-full rounded-xl border border-app-border bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-app-blue focus:ring-4 focus:ring-blue-100"
              />
            </div>
            {normalizedSearchQuery ? (
              <p className="text-xs font-semibold text-gray-500">검색 결과 {matchedScheduleCount}개</p>
            ) : null}
          </div>
        ) : null}
        {view === 'week' ? (
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = dateKey(day);
              const daySchedules = schedulesByDate[key] ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={cn(
                    'flex min-h-24 flex-col rounded-2xl px-1 py-2 text-center transition',
                    isSelected ? 'bg-app-blueSoft ring-2 ring-app-blue/30' : 'bg-gray-50',
                  )}
                  onClick={() => setSelectedDateKey(key)}
                >
                  <div className="h-11 shrink-0">
                    <p className="text-[10px] font-bold uppercase text-gray-400">
                      {['월', '화', '수', '목', '금', '토', '일'][day.getDay() === 0 ? 6 : day.getDay() - 1]}
                    </p>
                    <p
                      className={cn(
                        'mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black',
                        isToday ? 'bg-app-blue text-white' : 'text-gray-700',
                        isSelected && !isToday && 'bg-white text-app-blue',
                      )}
                    >
                      {format(day, 'd')}
                    </p>
                  </div>
                  <div className="mt-1 min-h-11 flex-1 space-y-1">
                    {daySchedules.slice(0, 2).map((schedule) => {
                      const participants = room.members.filter((member) => schedule.participantMemberIds.includes(member.id));
                      const isShared = participants.length > 1;
                      const primaryColor = isShared ? room.sharedScheduleColor : participants[0]?.color ?? room.color;
                      const highlighted = isHighlighted(schedule);

                      return (
                        <span
                          key={schedule.id}
                          className={cn(
                            'block h-5 w-full truncate rounded px-1 text-left text-[10px] font-bold',
                            !highlighted && 'opacity-25',
                          )}
                          style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                        >
                          {schedule.title}
                        </span>
                      );
                    })}
                    {daySchedules.length > 2 ? (
                      <span className="block truncate px-1 text-left text-[10px] font-bold text-gray-400">
                        +{daySchedules.length - 2}개
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((filter) => (
          <ParticipantFilterChip
            key={filter.id}
            label={filter.label}
            active={selectedFilter === filter.id}
            onClick={() => setSelectedFilter(filter.id)}
          />
        ))}
      </div>

      {view === 'month' ? (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-app-border bg-gray-50 text-center text-[11px] font-bold text-gray-500">
            {['월', '화', '수', '목', '금', '토', '일'].map((weekday) => (
              <div key={weekday} className="py-2">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-app-border gap-px">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const daySchedules = schedulesByDate[key] ?? [];
              const isToday = key === todayKey;
              const isCurrentMonth = isSameMonth(day, calendarDate);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-24 p-1.5 transition',
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50/80 opacity-45',
                  )}
                >
                  <div
                    className={cn(
                      'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black',
                      isToday ? 'bg-app-blue text-white' : 'text-gray-700',
                      isCurrentMonth && !isToday && 'text-gray-950',
                      !isCurrentMonth && !isToday && 'text-gray-300',
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map((schedule) => {
                      const participants = room.members.filter((member) => schedule.participantMemberIds.includes(member.id));
                      const isShared = participants.length > 1;
                      const primaryColor = isShared ? room.sharedScheduleColor : participants[0]?.color ?? room.color;
                      const highlighted = isHighlighted(schedule);

                      return (
                        <button
                          key={schedule.id}
                          type="button"
                          className={cn(
                            'block h-6 w-full truncate rounded-md px-1.5 text-left text-[11px] font-bold',
                            !highlighted && 'opacity-25',
                            !isCurrentMonth && 'opacity-50',
                          )}
                          style={{ backgroundColor: `${primaryColor}18`, color: primaryColor }}
                          onClick={() => onScheduleClick(schedule)}
                        >
                          {schedule.title}
                        </button>
                      );
                    })}
                    {daySchedules.length > 3 ? (
                      <p className="truncate px-1 text-[10px] font-bold text-gray-400">+{daySchedules.length - 3}개 더보기</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
        <div className="border-b border-app-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-950">
                {format(selectedDate, 'M월 d일')} {weekdayLabels[selectedDate.getDay()]}
              </h3>
              <p className="text-xs text-gray-500">일정 {selectedDaySchedules.length}개</p>
            </div>
            <div className="flex items-center gap-2">
              {timeTableAction}
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-app-blue">30분</span>
            </div>
          </div>
        </div>
        <div className={cn('relative overflow-y-auto bg-white', compact ? 'h-[420px]' : 'h-[1344px]')}>
          {hourRows.map((minutes) => (
            <div
              key={minutes}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: `${((minutes - dayStart) / totalMinutes) * 100}%` }}
            >
              <span className="absolute left-3 top-1 text-[10px] font-semibold text-gray-400">
                {minutes === dayEnd ? '24:00' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`}
              </span>
            </div>
          ))}
          {weekDateKeys.has(todayKey) && selectedDateKey === todayKey && isCurrentTimeVisible ? (
            <div
              className="absolute left-12 right-3 z-10 border-t border-red-500"
              style={{ top: `${currentTimeTop}%` }}
            >
              <span className="absolute -left-10 -top-2 text-[10px] font-bold text-red-500">
                {String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:{String(currentMinutes % 60).padStart(2, '0')}
              </span>
            </div>
          ) : null}
          {selectedDaySchedules.map((schedule, index) => {
            const start = minutesFromDayStart(schedule.startAt);
            const end = minutesFromDayStart(schedule.endAt);
            const boundedStart = Math.max(start, dayStart);
            const boundedEnd = Math.min(Math.max(end, boundedStart + 30), dayEnd);
            const top = ((boundedStart - dayStart) / totalMinutes) * 100;
            const height = Math.max(((boundedEnd - boundedStart) / totalMinutes) * 100, 2.5);
            const isShortBlock = boundedEnd - boundedStart <= 60;
            const participants = room.members.filter((member) => schedule.participantMemberIds.includes(member.id));
            const isShared = participants.length > 1;
            const primaryColor = isShared ? room.sharedScheduleColor : participants[0]?.color ?? room.color;
            const highlighted = isHighlighted(schedule);

            return (
              <button
                key={schedule.id}
                type="button"
                className={cn(
                  'absolute left-16 min-w-[142px] overflow-hidden rounded-xl border bg-white text-left shadow-sm transition',
                  isShortBlock ? 'px-2 py-1.5' : 'p-3',
                  !highlighted && 'opacity-25',
                )}
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  minHeight: isShortBlock ? '34px' : '52px',
                  right: index % 2 === 0 ? '48%' : '12px',
                  borderColor: primaryColor,
                  backgroundColor: `${primaryColor}16`,
                }}
                onClick={() => onScheduleClick(schedule)}
              >
                {isShortBlock ? (
                  <div className="flex h-full min-w-0 items-center gap-1.5">
                    {isShared ? <Users className="h-3 w-3 shrink-0" style={{ color: primaryColor }} /> : null}
                    <p className="min-w-0 flex-1 truncate text-[11px] font-black text-gray-950">{schedule.title}</p>
                    <span className="shrink-0 text-[10px] font-bold" style={{ color: primaryColor }}>
                      {format(new Date(schedule.startAt), 'HH:mm')}
                    </span>
                    <span className="min-w-0 shrink truncate text-[10px] text-gray-500">
                      {participants.map((member) => member.nickname).join(' · ')}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      {isShared ? <Users className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} /> : null}
                      <p className="min-w-0 truncate text-xs font-black text-gray-950">{schedule.title}</p>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-bold" style={{ color: primaryColor }}>
                      {format(new Date(schedule.startAt), 'HH:mm')} - {format(new Date(schedule.endAt), 'HH:mm')}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-gray-500">
                      {participants.map((member) => member.nickname).join(' · ')}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
        </Card>
      )}
    </div>
  );
}
