'use server';

import type { PreliminaryTask, RoomMember, Schedule, UserPreference } from '@/domain/entities';
import { hasRecentAuthentication } from '@/domain/auth/account-policy';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; message: string }
  : { ok: true; data: T } | { ok: false; message: string };

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '요청을 처리하지 못했습니다.';
}

function logActionError(action: string, error: unknown) {
  console.error(`[schedule-action:${action}]`, error);
}

function supabaseArgs<T extends Record<string, unknown>>(value: T) {
  return value as never;
}

function supabasePayload<T extends Record<string, unknown> | Array<Record<string, unknown>>>(value: T) {
  return value as never;
}

export async function createRoomAction(values: {
  name: string;
  description: string;
  nickname: string;
  color: string;
  sharedScheduleColor: string;
  defaultView: 'week' | 'month';
  businessStartTime: string;
  businessEndTime: string;
}): Promise<ActionResult<{ roomId: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_scheduling_room', supabaseArgs({
      p_name: values.name,
      p_description: values.description || null,
      p_nickname: values.nickname,
      p_color: values.color,
      p_shared_schedule_color: values.sharedScheduleColor,
      p_default_view: values.defaultView,
      p_business_start_time: values.businessStartTime,
      p_business_end_time: values.businessEndTime,
    }));

    if (error) {
      throw error;
    }

    const result = data as { room_id?: string } | null;

    if (!result?.room_id) {
      throw new Error('방 생성 결과를 확인하지 못했습니다.');
    }

    return { ok: true, data: { roomId: result.room_id } };
  } catch (error) {
    logActionError('createRoomAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function saveScheduleAction(values: {
  scheduleId?: string;
  roomId: string;
  title: string;
  participantMemberIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  address: string;
  customerPhone: string;
  estimatedPrice: string;
  additionalInfo: string;
}): Promise<ActionResult<{ scheduleId: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data: memberData, error: memberError } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', values.roomId)
      .eq('user_id', user.id)
      .single();

    if (memberError) {
      throw memberError;
    }

    const estimatedPrice = values.estimatedPrice.trim() ? Number(values.estimatedPrice) : null;
    const payload = {
      room_id: values.roomId,
      title: values.title,
      start_at: `${values.date}T${values.startTime}:00+09:00`,
      end_at: `${values.date}T${values.endTime}:00+09:00`,
      address: values.address.trim() || null,
      customer_phone: values.customerPhone.trim() || null,
      estimated_price: estimatedPrice,
      additional_info: values.additionalInfo.trim() || null,
      created_by_member_id: String((memberData as { id: string }).id),
    };

    const scheduleResult = values.scheduleId
      ? await supabase.from('schedules').update(supabasePayload(payload)).eq('id', values.scheduleId).select('id').single()
      : await supabase.from('schedules').insert(supabasePayload(payload)).select('id').single();

    if (scheduleResult.error) {
      throw scheduleResult.error;
    }

    const scheduleId = String((scheduleResult.data as { id: string }).id);
    const participantRows = [...new Set(values.participantMemberIds)].map((roomMemberId) => ({
      schedule_id: scheduleId,
      room_member_id: roomMemberId,
    }));

    if (values.scheduleId) {
      const { error } = await supabase.from('schedule_participants').delete().eq('schedule_id', scheduleId);

      if (error) {
        throw error;
      }
    }

    if (participantRows.length > 0) {
      const { error } = await supabase.from('schedule_participants').insert(supabasePayload(participantRows));

      if (error) {
        throw error;
      }
    }

    return { ok: true, data: { scheduleId } };
  } catch (error) {
    logActionError('saveScheduleAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function deleteScheduleAction(schedule: Pick<Schedule, 'id' | 'roomId'>): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('schedules').delete().eq('id', schedule.id);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('deleteScheduleAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updateScheduleCheckedAction(values: {
  scheduleId: string;
  isChecked: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { error } = await supabase
      .from('schedule_user_states')
      .upsert(supabasePayload({
        schedule_id: values.scheduleId,
        user_id: user.id,
        is_checked: values.isChecked,
        updated_at: new Date().toISOString(),
      }));

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updateScheduleCheckedAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updateScheduleStatusAction(schedule: Pick<Schedule, 'id' | 'roomId'> & {
  status: Schedule['status'];
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('schedules')
      .update(supabasePayload({ status: schedule.status }))
      .eq('id', schedule.id);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updateScheduleStatusAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function deleteRoomAction(roomId: string): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('delete_scheduling_room', supabaseArgs({
      p_room_id: roomId,
    }));

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('deleteRoomAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function createPreliminaryTaskAction(values: {
  userId: string;
  roomId: string | null;
  title: string;
  memo: string | null;
  priority: PreliminaryTask['priority'];
  dueDate: string | null;
}): Promise<ActionResult<{ taskId: string }>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('preliminary_tasks')
      .insert(supabasePayload({
        user_id: values.userId,
        room_id: values.roomId,
        title: values.title,
        memo: values.memo,
        priority: values.priority,
        due_date: values.dueDate,
      }))
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { ok: true, data: { taskId: String((data as { id: string }).id) } };
  } catch (error) {
    logActionError('createPreliminaryTaskAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function deletePreliminaryTaskAction(taskId: string): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('preliminary_tasks').delete().eq('id', taskId);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('deletePreliminaryTaskAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updatePreliminaryTaskAction(values: {
  taskId: string;
  roomId: string | null;
  title: string;
  memo: string | null;
  priority: PreliminaryTask['priority'];
  dueDate: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('preliminary_tasks')
      .update(supabasePayload({
        room_id: values.roomId,
        title: values.title,
        memo: values.memo,
        priority: values.priority,
        due_date: values.dueDate,
      }))
      .eq('id', values.taskId);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updatePreliminaryTaskAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updatePreliminaryTaskCompletedAction(values: {
  taskId: string;
  isCompleted: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('preliminary_tasks')
      .update(supabasePayload({ is_completed: values.isCompleted }))
      .eq('id', values.taskId);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updatePreliminaryTaskCompletedAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updateMemberRoleAction(values: {
  roomId: string;
  memberId: string;
  role: RoomMember['role'];
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('set_room_manager_role', supabaseArgs({
      p_room_id: values.roomId,
      p_member_id: values.memberId,
      p_is_manager: values.role === 'manager',
    }));

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updateMemberRoleAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function kickMemberAction(values: {
  roomId: string;
  memberId: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('room_members').delete().eq('id', values.memberId).eq('room_id', values.roomId);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('kickMemberAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function transferOwnershipAction(values: {
  roomId: string;
  memberId: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('transfer_room_ownership', supabaseArgs({
      p_room_id: values.roomId,
      p_new_owner_member_id: values.memberId,
    }));

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('transferOwnershipAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updateProfileAction(values: {
  name: string;
  phone: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { error } = await supabase
      .from('profiles')
      .update(supabasePayload({ name: values.name, phone: values.phone }))
      .eq('id', user.id);

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updateProfileAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updateCurrentPasswordAction(values: {
  password: string;
}): Promise<ActionResult> {
  try {
    if (values.password.length < 12) {
      throw new Error('비밀번호는 12자 이상이어야 합니다.');
    }

    if (!/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password) || !/[^A-Za-z0-9]/.test(values.password)) {
      throw new Error('비밀번호에는 대문자, 소문자, 숫자, 특수문자가 모두 포함되어야 합니다.');
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const { data: profile } = await supabase.from('profiles')
      .select('last_reauthenticated_at').eq('id', user.id).single() as unknown as {
        data: { last_reauthenticated_at: string | null } | null;
      };
    if (!hasRecentAuthentication(profile?.last_reauthenticated_at)) {
      throw new Error('최근 인증이 필요합니다.');
    }

    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      throw error;
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) throw signOutError;

    return { ok: true };
  } catch (error) {
    logActionError('updateCurrentPasswordAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}

export async function updateUserPreferencesAction(values: {
  defaultCalendarView: UserPreference['defaultCalendarView'];
  filterOpacity: number;
  pushEnabled: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const filterOpacity = Math.min(Math.max(Math.round(values.filterOpacity), 0), 100);
    const { error } = await supabase
      .from('user_preferences')
      .upsert(supabasePayload({
        user_id: user.id,
        push_enabled: values.pushEnabled,
        default_calendar_view: values.defaultCalendarView,
        filter_opacity: filterOpacity,
      }));

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch (error) {
    logActionError('updateUserPreferencesAction', error);
    return { ok: false, message: messageFromError(error) };
  }
}
