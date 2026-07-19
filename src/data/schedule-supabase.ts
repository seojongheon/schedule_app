import type { PreliminaryTask, Profile, RoomMember, Schedule, SchedulingRoom, UserPreference } from '@/domain/entities';
import { buildScheduleWorkspaceQueryPlan, type ScheduleWorkspaceRequest } from '@/data/schedule-workspace-query';
import { countSchedulesOverlappingDay, getKoreanDayBounds } from '@/lib/schedule-day';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ScheduleWorkspaceInitialData {
  rooms: SchedulingRoom[];
  schedules: Schedule[];
  tasks: PreliminaryTask[];
  preference?: UserPreference;
}

const ROOM_COLUMNS = 'id,name,description,color,shared_schedule_color,owner_user_id,status,default_view,business_start_time,business_end_time,updated_at';
const MEMBER_COLUMNS = 'id,room_id,user_id,nickname,role,color,joined_at,last_active_at';
const SCHEDULE_COLUMNS = 'id,room_id,title,start_at,end_at,address,customer_phone,estimated_price,additional_info,status,created_by_member_id,updated_at';
const PARTICIPANT_COLUMNS = 'schedule_id,room_member_id';
const STATE_COLUMNS = 'schedule_id,user_id,is_checked';
const TASK_COLUMNS = 'id,user_id,room_id,title,memo,priority,due_date,is_completed';
const PREFERENCE_COLUMNS = 'user_id,push_enabled,default_calendar_view,filter_opacity';

type RoomRow = {
  id: string; name: string; description: string | null; color: string; shared_schedule_color: string; owner_user_id: string;
  status: SchedulingRoom['status']; default_view: SchedulingRoom['defaultView']; business_start_time: string; business_end_time: string; updated_at: string;
};
type MemberRow = { id: string; room_id: string; user_id: string; nickname: string; role: RoomMember['role']; color: string; joined_at: string; last_active_at: string | null };
type ScheduleRow = {
  id: string; room_id: string; title: string; start_at: string; end_at: string; address: string | null; customer_phone: string | null;
  estimated_price: number | null; additional_info: string | null; status: Schedule['status']; created_by_member_id: string; updated_at: string;
};
type ScheduleParticipantRow = { schedule_id: string; room_member_id: string };
type ScheduleStateRow = { schedule_id: string; user_id: string; is_checked: boolean };
type TaskRow = { id: string; user_id: string; room_id: string | null; title: string; memo: string | null; priority: PreliminaryTask['priority']; due_date: string | null; is_completed: boolean };
type PreferenceRow = { user_id: string; push_enabled: boolean; default_calendar_view: UserPreference['defaultCalendarView']; filter_opacity: number };

function mapPreference(row: PreferenceRow): UserPreference {
  return { userId: row.user_id, pushEnabled: row.push_enabled, defaultCalendarView: row.default_calendar_view, filterOpacity: row.filter_opacity };
}

function mapTask(task: TaskRow): PreliminaryTask {
  return { id: task.id, userId: task.user_id, roomId: task.room_id, title: task.title, memo: task.memo, priority: task.priority, dueDate: task.due_date, isCompleted: task.is_completed };
}

function timeText(value: string) {
  return value.slice(0, 5);
}

function formatRecentActivity(updatedAt: string) {
  const diffMinutes = Math.max(Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000), 0);
  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전 업데이트`;
  const diffHours = Math.floor(diffMinutes / 60);
  return diffHours < 24 ? `${diffHours}시간 전 업데이트` : `${Math.floor(diffHours / 24)}일 전 업데이트`;
}

export async function getScheduleWorkspaceData(
  profile: Profile,
  request: ScheduleWorkspaceRequest,
): Promise<ScheduleWorkspaceInitialData> {
  try {
    const supabase = await createSupabaseServerClient();
    const plan = buildScheduleWorkspaceQueryPlan(request);
    let roomQuery = supabase.from('scheduling_rooms').select(ROOM_COLUMNS).order('updated_at', { ascending: false });
    if (plan.roomId) roomQuery = roomQuery.eq('id', plan.roomId);
    const { data: roomData, error: roomError } = await roomQuery;
    if (roomError) throw roomError;

    const roomRows = (roomData ?? []) as unknown as RoomRow[];
    const roomIds = roomRows.map((room) => room.id);
    const shouldLoadSchedules = roomIds.length > 0 && plan.includeSchedules !== 'none';
    const dayBounds = plan.includeSchedules === 'today' ? getKoreanDayBounds() : null;

    const membersPromise = roomIds.length > 0
      ? supabase.from('room_members').select(MEMBER_COLUMNS).in('room_id', roomIds)
      : Promise.resolve({ data: [] });
    const tasksPromise = plan.includeTasks
      ? supabase.from('preliminary_tasks').select(TASK_COLUMNS).eq('user_id', profile.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] });
    const preferencePromise = plan.includePreference
      ? supabase.from('user_preferences').select(PREFERENCE_COLUMNS).eq('user_id', profile.id).single()
      : Promise.resolve({ data: null });
    const schedulesPromise = !shouldLoadSchedules
      ? Promise.resolve({ data: [] })
      : plan.includeSchedules === 'today' && dayBounds
        ? supabase.from('schedules').select(SCHEDULE_COLUMNS).in('room_id', roomIds).lt('start_at', dayBounds.endAt).gt('end_at', dayBounds.startAt).order('start_at', { ascending: true })
        : supabase.from('schedules').select(SCHEDULE_COLUMNS).in('room_id', roomIds).order('start_at', { ascending: true });

    const [{ data: memberData }, { data: taskData }, { data: preferenceData }, { data: scheduleData }] = await Promise.all([
      membersPromise, tasksPromise, preferencePromise, schedulesPromise,
    ]);
    const memberRows = (memberData ?? []) as unknown as MemberRow[];
    const scheduleRows = (scheduleData ?? []) as unknown as ScheduleRow[];
    const scheduleIds = scheduleRows.map((schedule) => schedule.id);
    const participantsPromise = plan.includeParticipants && scheduleIds.length > 0
      ? supabase.from('schedule_participants').select(PARTICIPANT_COLUMNS).in('schedule_id', scheduleIds)
      : Promise.resolve({ data: [] });
    const statesPromise = plan.includeStates && scheduleIds.length > 0
      ? supabase.from('schedule_user_states').select(STATE_COLUMNS).eq('user_id', profile.id).in('schedule_id', scheduleIds)
      : Promise.resolve({ data: [] });
    const [{ data: participantData }, { data: stateData }] = await Promise.all([participantsPromise, statesPromise]);

    const membersByRoomId = memberRows.reduce<Map<string, RoomMember[]>>((groups, member) => {
      const members = groups.get(member.room_id) ?? [];
      members.push({
        id: member.id, roomId: member.room_id, userId: member.user_id, nickname: member.nickname, role: member.role, color: member.color,
        joinedAt: member.joined_at, lastActiveAt: member.last_active_at,
        email: member.user_id === profile.id ? profile.email : `${member.nickname}@room.local`,
        name: member.user_id === profile.id ? profile.name : member.nickname,
      });
      groups.set(member.room_id, members);
      return groups;
    }, new Map());
    const participantsByScheduleId = ((participantData ?? []) as unknown as ScheduleParticipantRow[]).reduce<Map<string, string[]>>((groups, row) => {
      groups.set(row.schedule_id, [...(groups.get(row.schedule_id) ?? []), row.room_member_id]);
      return groups;
    }, new Map());
    const checkedByScheduleId = new Map(((stateData ?? []) as unknown as ScheduleStateRow[]).map((row) => [row.schedule_id, row.is_checked]));
    const schedules = scheduleRows.map<Schedule>((schedule) => ({
      id: schedule.id, roomId: schedule.room_id, title: schedule.title, startAt: schedule.start_at, endAt: schedule.end_at,
      address: schedule.address, customerPhone: schedule.customer_phone, estimatedPrice: schedule.estimated_price, additionalInfo: schedule.additional_info,
      status: schedule.status, createdByMemberId: schedule.created_by_member_id, updatedAt: schedule.updated_at,
      participantMemberIds: participantsByScheduleId.get(schedule.id) ?? [], isChecked: checkedByScheduleId.get(schedule.id) ?? false,
    }));
    const rooms = roomRows.map<SchedulingRoom>((room) => {
      const roomSchedules = schedules.filter((schedule) => schedule.roomId === room.id);
      const nextSchedule = roomSchedules.find((schedule) => new Date(schedule.startAt).getTime() >= Date.now());
      return {
        id: room.id, name: room.name, description: room.description, color: room.color, sharedScheduleColor: room.shared_schedule_color,
        ownerUserId: room.owner_user_id, status: room.status, defaultView: room.default_view,
        businessStartTime: timeText(room.business_start_time), businessEndTime: timeText(room.business_end_time), members: membersByRoomId.get(room.id) ?? [],
        todayScheduleCount: countSchedulesOverlappingDay(roomSchedules),
        nextSchedule: nextSchedule ? `${timeText(nextSchedule.startAt.split('T')[1] ?? '')} ${nextSchedule.title}` : null,
        recentActivity: formatRecentActivity(room.updated_at),
      };
    });

    return {
      rooms,
      schedules,
      tasks: ((taskData ?? []) as unknown as TaskRow[]).map(mapTask),
      preference: preferenceData ? mapPreference(preferenceData as unknown as PreferenceRow) : undefined,
    };
  } catch {
    return { rooms: [], schedules: [], tasks: [] };
  }
}
