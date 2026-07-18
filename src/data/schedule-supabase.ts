import type { PreliminaryTask, Profile, RoomMember, Schedule, SchedulingRoom, UserPreference } from '@/domain/entities';
import { countSchedulesOverlappingDay } from '@/lib/schedule-day';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ScheduleWorkspaceInitialData {
  rooms: SchedulingRoom[];
  schedules: Schedule[];
  tasks: PreliminaryTask[];
  preference?: UserPreference;
}

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  shared_schedule_color: string;
  owner_user_id: string;
  status: SchedulingRoom['status'];
  default_view: SchedulingRoom['defaultView'];
  business_start_time: string;
  business_end_time: string;
  updated_at: string;
};

type MemberRow = {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  role: RoomMember['role'];
  color: string;
  joined_at: string;
  last_active_at: string | null;
};

type ScheduleRow = {
  id: string;
  room_id: string;
  title: string;
  start_at: string;
  end_at: string;
  address: string | null;
  customer_phone: string | null;
  estimated_price: number | null;
  additional_info: string | null;
  status: Schedule['status'];
  created_by_member_id: string;
  updated_at: string;
};

type ScheduleParticipantRow = {
  schedule_id: string;
  room_member_id: string;
};

type ScheduleStateRow = {
  schedule_id: string;
  user_id: string;
  is_checked: boolean;
};

type TaskRow = {
  id: string;
  user_id: string;
  room_id: string | null;
  title: string;
  memo: string | null;
  priority: PreliminaryTask['priority'];
  due_date: string | null;
  is_completed: boolean;
};

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_service_admin: boolean;
  status: Profile['status'];
  last_login_at: string | null;
};

type PreferenceRow = {
  user_id: string;
  push_enabled: boolean;
  default_calendar_view: UserPreference['defaultCalendarView'];
  filter_opacity: number;
};

function mapPreference(row: PreferenceRow): UserPreference {
  return {
    userId: row.user_id,
    pushEnabled: row.push_enabled,
    defaultCalendarView: row.default_calendar_view,
    filterOpacity: row.filter_opacity,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    isServiceAdmin: row.is_service_admin,
    status: row.status,
    lastLoginAt: row.last_login_at,
  };
}

function timeText(value: string) {
  return value.slice(0, 5);
}

function formatRecentActivity(updatedAt: string) {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffMinutes = Math.max(Math.floor(diffMs / 60_000), 0);

  if (diffMinutes < 1) {
    return '방금 전';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전 업데이트`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}시간 전 업데이트`;
  }

  return `${Math.floor(diffHours / 24)}일 전 업데이트`;
}

export async function getScheduleWorkspaceData(profile: Profile): Promise<ScheduleWorkspaceInitialData> {
  try {
    const supabase = await createSupabaseServerClient();
    const preferencePromise = supabase.from('user_preferences').select('*').eq('user_id', profile.id).single();

    const { data: roomData, error: roomError } = await supabase
      .from('scheduling_rooms')
      .select('*')
      .order('updated_at', { ascending: false });

    if (roomError) {
      throw roomError;
    }

    const roomRows = (roomData ?? []) as RoomRow[];
    const roomIds = roomRows.map((room) => room.id);

    if (roomIds.length === 0) {
      const { data: taskData } = await supabase
        .from('preliminary_tasks')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      const { data: preferenceData } = await preferencePromise;

      return {
        rooms: [],
        schedules: [],
        preference: preferenceData ? mapPreference(preferenceData as PreferenceRow) : undefined,
        tasks: ((taskData ?? []) as TaskRow[]).map((task) => ({
          id: task.id,
          userId: task.user_id,
          roomId: task.room_id,
          title: task.title,
          memo: task.memo,
          priority: task.priority,
          dueDate: task.due_date,
          isCompleted: task.is_completed,
        })),
      };
    }

    const [
      { data: memberData },
      { data: scheduleData },
      { data: taskData },
      { data: preferenceData },
    ] = await Promise.all([
      supabase.from('room_members').select('*').in('room_id', roomIds),
      supabase.from('schedules').select('*').in('room_id', roomIds).order('start_at', { ascending: true }),
      supabase.from('preliminary_tasks').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      preferencePromise,
    ]);

    const memberRows = (memberData ?? []) as MemberRow[];
    const scheduleRows = (scheduleData ?? []) as ScheduleRow[];
    const scheduleIds = scheduleRows.map((schedule) => schedule.id);

    const [{ data: participantData }, { data: stateData }] = scheduleIds.length > 0
      ? await Promise.all([
          supabase.from('schedule_participants').select('*').in('schedule_id', scheduleIds),
          supabase.from('schedule_user_states').select('*').eq('user_id', profile.id).in('schedule_id', scheduleIds),
        ])
      : [{ data: [] }, { data: [] }];

    const membersByRoomId = memberRows.reduce<Map<string, RoomMember[]>>((groups, member) => {
      const roomMembers = groups.get(member.room_id) ?? [];
      const name = member.user_id === profile.id ? profile.name : member.nickname;
      const email = member.user_id === profile.id ? profile.email : `${member.nickname}@room.local`;

      groups.set(member.room_id, [
        ...roomMembers,
        {
          id: member.id,
          roomId: member.room_id,
          userId: member.user_id,
          nickname: member.nickname,
          role: member.role,
          color: member.color,
          joinedAt: member.joined_at,
          lastActiveAt: member.last_active_at,
          email,
          name,
        },
      ]);

      return groups;
    }, new Map());

    const participantsByScheduleId = ((participantData ?? []) as ScheduleParticipantRow[]).reduce<Map<string, string[]>>(
      (groups, participant) => {
        groups.set(participant.schedule_id, [...(groups.get(participant.schedule_id) ?? []), participant.room_member_id]);
        return groups;
      },
      new Map(),
    );
    const checkedByScheduleId = new Map(
      ((stateData ?? []) as ScheduleStateRow[]).map((state) => [state.schedule_id, state.is_checked]),
    );

    const schedules: Schedule[] = scheduleRows.map((schedule) => ({
      id: schedule.id,
      roomId: schedule.room_id,
      title: schedule.title,
      startAt: schedule.start_at,
      endAt: schedule.end_at,
      address: schedule.address,
      customerPhone: schedule.customer_phone,
      estimatedPrice: schedule.estimated_price,
      additionalInfo: schedule.additional_info,
      status: schedule.status,
      createdByMemberId: schedule.created_by_member_id,
      updatedAt: schedule.updated_at,
      participantMemberIds: participantsByScheduleId.get(schedule.id) ?? [],
      isChecked: checkedByScheduleId.get(schedule.id) ?? false,
    }));

    const rooms: SchedulingRoom[] = roomRows.map((room) => {
      const roomSchedules = schedules.filter((schedule) => schedule.roomId === room.id);
      const nextSchedule = roomSchedules.find((schedule) => new Date(schedule.startAt).getTime() >= Date.now());

      return {
        id: room.id,
        name: room.name,
        description: room.description,
        color: room.color,
        sharedScheduleColor: room.shared_schedule_color,
        ownerUserId: room.owner_user_id,
        status: room.status,
        defaultView: room.default_view,
        businessStartTime: timeText(room.business_start_time),
        businessEndTime: timeText(room.business_end_time),
        members: membersByRoomId.get(room.id) ?? [],
        todayScheduleCount: countSchedulesOverlappingDay(roomSchedules),
        nextSchedule: nextSchedule ? `${timeText(nextSchedule.startAt.split('T')[1] ?? '')} ${nextSchedule.title}` : null,
        recentActivity: formatRecentActivity(room.updated_at),
      };
    });

    return {
      rooms,
      schedules,
      preference: preferenceData ? mapPreference(preferenceData as PreferenceRow) : undefined,
      tasks: ((taskData ?? []) as TaskRow[]).map((task) => ({
        id: task.id,
        userId: task.user_id,
        roomId: task.room_id,
        title: task.title,
        memo: task.memo,
        priority: task.priority,
        dueDate: task.due_date,
        isCompleted: task.is_completed,
      })),
    };
  } catch {
    return {
      rooms: [],
      schedules: [],
      tasks: [],
    };
  }
}
