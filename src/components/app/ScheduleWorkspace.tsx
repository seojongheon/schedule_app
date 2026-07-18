'use client';

import {
  ArrowLeft,
  CalendarPlus,
  Crown,
  ImagePlus,
  KeyRound,
  MapPinned,
  MessageCircle,
  MoreVertical,
  Navigation,
  Phone,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  createPreliminaryTaskAction,
  createRoomAction,
  deletePreliminaryTaskAction,
  deleteRoomAction,
  deleteScheduleAction,
  kickMemberAction,
  saveScheduleAction,
  transferOwnershipAction,
  updateMemberRoleAction,
  updateCurrentPasswordAction,
  updatePreliminaryTaskAction,
  updatePreliminaryTaskCompletedAction,
  updateProfileAction,
  updateScheduleCheckedAction,
  updateScheduleStatusAction,
  updateUserPreferencesAction,
} from '@/app/actions/schedule-actions';
import type { ScheduleWorkspaceInitialData } from '@/data/schedule-supabase';
import type { PreliminaryTask, Profile, RoomMember, Schedule, SchedulingRoom, UserPreference } from '@/domain/entities';
import { AppFrame } from '@/components/app/AppFrame';
import { AppHeader } from '@/components/app/AppHeader';
import { PreliminaryTaskCard } from '@/components/app/PreliminaryTaskCard';
import { RoomCard } from '@/components/app/RoomCard';
import { RoomInvitePanel } from '@/components/app/RoomInvitePanel';
import { ScheduleCalendar } from '@/components/app/ScheduleCalendar';
import { TodayTaskCard } from '@/components/app/TodayTaskCard';
import { ParticipantAvatar, ParticipantAvatarGroup } from '@/components/common/ParticipantAvatar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/StateBlocks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, TextareaField } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { currentUser, preliminaryTasks as initialTasks, rooms as initialRooms, schedules as initialSchedules } from '@/lib/mock-data';
import { accountStatusLabels, roomRoleLabels } from '@/lib/korean-labels';
import { getSchedulesAssignedToProfile } from '@/lib/dashboard-schedules';
import { isScheduleOverlappingDay } from '@/lib/schedule-day';
import { cn, formatCurrency } from '@/lib/utils';
import { recognizeImageText } from '@/components/app/image-ocr';
import { parseScheduleText } from '@/components/app/schedule-text-parser';

type WorkspacePage = 'dashboard' | 'todayTasks' | 'preliminaryTasks' | 'rooms' | 'room' | 'mypage';
type SheetType =
  | 'createRoom'
  | 'createComplete'
  | 'joinRoom'
  | 'scheduleForm'
  | 'scheduleDetail'
  | 'roomMenu'
  | 'participantManagement'
  | 'transferOwnership'
  | 'roomScheduleManagement'
  | 'preliminaryTask'
  | 'inviteInfo'
  | 'roomInfo'
  | null;

interface ScheduleWorkspaceProps {
  page: WorkspacePage;
  roomId?: string;
  profile?: Profile;
  initialData?: ScheduleWorkspaceInitialData;
}

type ScheduleFormValues = {
  title: string;
  participantMemberIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  address: string;
  customerPhone: string;
  estimatedPrice: string;
  additionalInfo: string;
};

type CreateRoomFormValues = {
  name: string;
  description: string;
  nickname: string;
  color: string;
  sharedScheduleColor: string;
  defaultView: 'week' | 'month';
  businessStartTime: string;
  businessEndTime: string;
};

type PreliminaryTaskFormValues = {
  title: string;
  memo: string;
  priority: PreliminaryTask['priority'];
  roomId: string;
  dueDate: string;
};

type JoinRoomFormValues = {
  invite: string;
  nickname: string;
};

type ProfileFormValues = {
  name: string;
  phone: string;
};

type PasswordFormValues = {
  password: string;
  passwordConfirm: string;
};

type UserPreferenceFormValues = {
  defaultCalendarView: UserPreference['defaultCalendarView'];
  filterOpacity: number;
  pushEnabled: boolean;
};

type InvitePreview = {
  result: 'active';
  roomName: string;
  roomDescription: string | null;
  inviterDisplayName: string;
  grantRole: 'member' | 'viewer';
  expiresAt: string;
};

const roomStorageKey = (userId: string) => `shared-schedule:rooms:${userId}`;

function defaultPreference(userId: string): UserPreference {
  return {
    userId,
    pushEnabled: false,
    defaultCalendarView: 'week',
    filterOpacity: 25,
  };
}

function mergeRooms(savedRooms: SchedulingRoom[], baseRooms: SchedulingRoom[]) {
  const merged = new Map<string, SchedulingRoom>();

  for (const room of baseRooms) {
    merged.set(room.id, room);
  }

  for (const room of savedRooms) {
    merged.set(room.id, room);
  }

  return Array.from(merged.values());
}

function roleCanManageSchedules(member?: RoomMember) {
  return member?.role === 'owner' || member?.role === 'manager';
}

function getMyMember(room: SchedulingRoom, profile: Profile) {
  return room.members.find((member) => member.userId === profile.id);
}

function getScheduleParticipants(room: SchedulingRoom, schedule: Schedule) {
  return room.members.filter((member) => schedule.participantMemberIds.includes(member.id));
}

function scheduleIdentity(schedule: Schedule) {
  return [
    schedule.roomId,
    schedule.title.trim(),
    schedule.startAt,
    schedule.endAt,
    schedule.address?.trim() ?? '',
    schedule.customerPhone?.replace(/[^\d+]/g, '') ?? '',
    schedule.estimatedPrice ?? '',
    [...new Set(schedule.participantMemberIds)].sort().join(','),
  ].join('|');
}

function uniqueSchedules(schedules: Schedule[]) {
  const seen = new Set<string>();

  return schedules.filter((schedule) => {
    const key = scheduleIdentity(schedule);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sanitizePhoneNumber(phone: string | null) {
  return phone?.replace(/[^\d+]/g, '') ?? '';
}

function formatPhoneForDisplay(phone: string | null) {
  return phone?.trim() || '-';
}

function buildNavigationUrls(address: string) {
  const encodedAddress = encodeURIComponent(address);

  return {
    kakao: `https://map.kakao.com/link/search/${encodedAddress}`,
    naver: `https://map.naver.com/p/search/${encodedAddress}`,
    google: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
  };
}

function buildGoogleCalendarUrl(schedule: Schedule) {
  const formatGoogleDate = (dateValue: string) =>
    new Date(dateValue).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: schedule.title,
    dates: `${formatGoogleDate(schedule.startAt)}/${formatGoogleDate(schedule.endAt)}`,
  });

  if (schedule.address) {
    params.set('location', schedule.address);
  }

  if (schedule.additionalInfo) {
    params.set('details', schedule.additionalInfo);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildMyCalendarRoom(profile: Profile, rooms: SchedulingRoom[]): SchedulingRoom {
  const myMembers = rooms.flatMap((room) => {
    const member = getMyMember(room, profile);
    return member ? [member] : [];
  });

  return {
    id: 'my-calendar',
    name: '내 일정',
    description: '참여 중인 모든 방의 내 일정입니다.',
    color: '#3558e6',
    sharedScheduleColor: '#8b6ff4',
    ownerUserId: profile.id,
    status: 'active',
    defaultView: 'week',
    businessStartTime: '00:00',
    businessEndTime: '24:00',
    members: myMembers.length > 0
      ? myMembers
      : [
          {
            id: `my-calendar-${profile.id}`,
            roomId: 'my-calendar',
            userId: profile.id,
            nickname: profile.name,
            role: 'member',
            color: '#3558e6',
            joinedAt: new Date().toISOString(),
            lastActiveAt: null,
            email: profile.email,
            name: profile.name,
          },
        ],
    todayScheduleCount: 0,
    nextSchedule: null,
    recentActivity: '',
  };
}

function inviteTokenFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, window.location.origin);
    const match = url.pathname.match(/^\/join\/([A-Za-z0-9_-]{43})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function ScheduleWorkspace({ page, roomId, profile = currentUser, initialData }: ScheduleWorkspaceProps) {
  const router = useRouter();
  const [workspaceProfile, setWorkspaceProfile] = useState(profile);
  const [rooms, setRooms] = useState(initialData?.rooms ?? initialRooms);
  const [schedules, setSchedules] = useState(initialData?.schedules ?? initialSchedules);
  const [tasks, setTasks] = useState(initialData?.tasks ?? initialTasks);
  const [preference, setPreference] = useState<UserPreference>(initialData?.preference ?? defaultPreference(profile.id));
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedTask, setSelectedTask] = useState<PreliminaryTask | null>(null);
  const [deleteScheduleOpen, setDeleteScheduleOpen] = useState(false);
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false);
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [roomRoleFilter, setRoomRoleFilter] = useState<'all' | RoomMember['role']>('all');
  const [sortMode, setSortMode] = useState<'recent' | 'name'>('recent');
  const [createdRoom, setCreatedRoom] = useState<SchedulingRoom | null>(null);
  const [roomsHydrated, setRoomsHydrated] = useState(false);
  const usesSupabaseData = Boolean(initialData);

  useEffect(() => {
    setWorkspaceProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (usesSupabaseData) {
      setRooms(initialData?.rooms ?? []);
      setSchedules(initialData?.schedules ?? []);
      setTasks(initialData?.tasks ?? []);
      setPreference(initialData?.preference ?? defaultPreference(profile.id));
      setRoomsHydrated(true);
      return;
    }

    try {
      const savedRooms = window.localStorage.getItem(roomStorageKey(workspaceProfile.id));

      if (savedRooms) {
        setRooms(mergeRooms(JSON.parse(savedRooms) as SchedulingRoom[], initialRooms));
      }
    } catch {
      // 저장된 데모 데이터가 깨진 경우 기본 방 목록으로 계속 동작합니다.
    } finally {
      setRoomsHydrated(true);
    }
  }, [initialData, profile, usesSupabaseData, workspaceProfile.id]);

  useEffect(() => {
    if (!roomsHydrated || usesSupabaseData) {
      return;
    }

    window.localStorage.setItem(roomStorageKey(workspaceProfile.id), JSON.stringify(rooms));
  }, [workspaceProfile.id, rooms, roomsHydrated, usesSupabaseData]);

  const emptyRoom: SchedulingRoom = {
    id: 'empty-room',
    name: '스케줄링 방',
    description: null,
    color: '#3558e6',
    sharedScheduleColor: '#8b6ff4',
    ownerUserId: workspaceProfile.id,
    status: 'active',
    defaultView: 'week',
    businessStartTime: '00:00',
    businessEndTime: '24:00',
    members: [],
    todayScheduleCount: 0,
    nextSchedule: null,
    recentActivity: '',
  };
  const activeRoom = rooms.find((room) => room.id === roomId) ?? rooms[0] ?? emptyRoom;
  const formRoom = selectedSchedule
    ? rooms.find((room) => room.id === selectedSchedule.roomId) ?? activeRoom
    : selectedTask?.roomId
      ? rooms.find((room) => room.id === selectedTask.roomId) ?? activeRoom
      : activeRoom;
  const displaySchedules = useMemo(() => uniqueSchedules(schedules), [schedules]);
  const visibleRoomSchedules = displaySchedules.filter((schedule) => schedule.roomId === activeRoom.id);
  const dashboardCalendarSchedules = getSchedulesAssignedToProfile(displaySchedules, rooms, workspaceProfile.id);
  const todaySchedules = dashboardCalendarSchedules
    .filter((schedule) => isScheduleOverlappingDay(schedule.startAt, schedule.endAt))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const filteredRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        const member = getMyMember(room, workspaceProfile);
        const matchesRole = roomRoleFilter === 'all' || member?.role === roomRoleFilter;
        const matchesSearch = room.name.toLowerCase().includes(roomSearch.toLowerCase());
        return matchesRole && matchesSearch;
      })
      .sort((a, b) => (sortMode === 'name' ? a.name.localeCompare(b.name) : b.recentActivity.localeCompare(a.recentActivity)));
  }, [workspaceProfile, roomRoleFilter, roomSearch, rooms, sortMode]);

  const openScheduleDetail = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setActiveSheet('scheduleDetail');
  };

  const convertTaskToSchedule = (task: PreliminaryTask) => {
    setSelectedTask(task);
    const targetRoom = task.roomId ? rooms.find((room) => room.id === task.roomId) : rooms[0];
    const member = targetRoom ? getMyMember(targetRoom, workspaceProfile) : undefined;

    if (!roleCanManageSchedules(member)) {
      setActiveSheet('roomInfo');
      return;
    }

    setActiveSheet('scheduleForm');
  };

  const addDemoRoom = async (values: CreateRoomFormValues) => {
    const result = usesSupabaseData ? await createRoomAction(values) : null;

    if (result && !result.ok) {
      window.alert(result.message);
      return;
    }

    if (usesSupabaseData && !result?.ok) {
      window.alert('Supabase 방 생성 응답을 확인하지 못했습니다.');
      return;
    }

    const roomId = result?.ok ? result.data.roomId : `room-${Date.now()}`;
    const memberId = `member-${Date.now()}`;
    const newRoom: SchedulingRoom = {
      id: roomId,
      name: values.name.trim(),
      description: values.description.trim() || null,
      color: values.color,
      sharedScheduleColor: values.sharedScheduleColor,
      ownerUserId: workspaceProfile.id,
      status: 'active',
      defaultView: values.defaultView,
      businessStartTime: values.businessStartTime,
      businessEndTime: values.businessEndTime,
      todayScheduleCount: 0,
      nextSchedule: null,
      recentActivity: '방금 전',
      members: [
        {
          id: memberId,
          roomId,
          userId: workspaceProfile.id,
          nickname: values.nickname.trim(),
          role: 'owner',
          color: values.color,
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          email: workspaceProfile.email,
          name: workspaceProfile.name,
        },
      ],
    };

    setRooms((previous) => [newRoom, ...previous]);
    setCreatedRoom(newRoom);
    setActiveSheet('createComplete');
    router.refresh();
  };

  const addDemoSchedule = async (values: ScheduleFormValues) => {
    const targetRoom = formRoom;
    const member = getMyMember(targetRoom, workspaceProfile) ?? targetRoom.members[0];
    const participantMemberIds = [...new Set(values.participantMemberIds.length > 0 ? values.participantMemberIds : [member.id])];
    const title = values.title.trim() || selectedTask?.title || '새 일정';
    const date = values.date || '2026-07-02';
    const startTime = values.startTime || '14:30';
    const endTime = values.endTime || '15:00';
    const estimatedPrice = values.estimatedPrice.trim() ? Number(values.estimatedPrice) : null;

    const newSchedule: Schedule = {
      id: selectedSchedule?.id ?? `schedule-${Date.now()}`,
      roomId: targetRoom.id,
      title,
      startAt: `${date}T${startTime}:00+09:00`,
      endAt: `${date}T${endTime}:00+09:00`,
      address: values.address.trim() || null,
      customerPhone: values.customerPhone.trim() || null,
      estimatedPrice,
      additionalInfo: values.additionalInfo.trim() || null,
      status: 'scheduled',
      createdByMemberId: member.id,
      updatedAt: new Date().toISOString(),
      participantMemberIds,
      isChecked: false,
    };

    if (usesSupabaseData) {
      const result = await saveScheduleAction({
        scheduleId: selectedSchedule?.id,
        roomId: targetRoom.id,
        title,
        participantMemberIds,
        date,
        startTime,
        endTime,
        address: values.address,
        customerPhone: values.customerPhone,
        estimatedPrice: values.estimatedPrice,
        additionalInfo: values.additionalInfo,
      });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }

      newSchedule.id = result.data.scheduleId;
    }

    setSchedules((previous) => {
      if (selectedSchedule) {
        return uniqueSchedules(previous.map((schedule) => (schedule.id === selectedSchedule.id ? newSchedule : schedule)));
      }

      const newScheduleKey = scheduleIdentity(newSchedule);
      const alreadyExists = previous.some((schedule) => scheduleIdentity(schedule) === newScheduleKey);

      return alreadyExists ? uniqueSchedules(previous) : uniqueSchedules([...previous, newSchedule]);
    });
    if (selectedTask) {
      setTasks((previous) => previous.filter((task) => task.id !== selectedTask.id));
    }
    setSelectedSchedule(null);
    setSelectedTask(null);
    setActiveSheet(null);
    router.refresh();
  };

  const joinDemoRoom = async (values: JoinRoomFormValues) => {
    const token = inviteTokenFromInput(values.invite);
    if (!token) return { ok: false, message: '올바른 초대 링크를 입력해주세요.' };

    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: values.nickname, color: '#3558e6' }),
      });
      const result = await response.json() as { roomId?: string; code?: string };
      if (!response.ok || !result.roomId) {
        return {
          ok: false,
          message: result.code === 'account_not_active'
            ? '활성 계정으로 로그인한 뒤 참여할 수 있습니다.'
            : '초대를 사용할 수 없습니다. 새 링크를 요청해주세요.',
        };
      }
      setActiveSheet(null);
      router.push(`/rooms/${result.roomId}`);
      router.refresh();
      return { ok: true, message: '' };
    } catch {
      return { ok: false, message: '초대 참여를 처리하지 못했습니다. 다시 시도해주세요.' };
    }
  };

  const addPreliminaryTask = async (values: PreliminaryTaskFormValues) => {
    const newTask: PreliminaryTask = {
      id: selectedTask?.id ?? `task-${Date.now()}`,
      userId: workspaceProfile.id,
      roomId: values.roomId === 'none' ? null : values.roomId,
      title: values.title.trim(),
      memo: values.memo.trim() || null,
      priority: values.priority,
      dueDate: values.dueDate || null,
      isCompleted: selectedTask?.isCompleted ?? false,
    };

    if (usesSupabaseData) {
      const result = selectedTask
        ? await updatePreliminaryTaskAction({
            taskId: selectedTask.id,
            roomId: newTask.roomId,
            title: newTask.title,
            memo: newTask.memo,
            priority: newTask.priority,
            dueDate: newTask.dueDate,
          })
        : await createPreliminaryTaskAction({
            userId: workspaceProfile.id,
            roomId: newTask.roomId,
            title: newTask.title,
            memo: newTask.memo,
            priority: newTask.priority,
            dueDate: newTask.dueDate,
          });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }

      if (!selectedTask && 'data' in result) {
        newTask.id = (result.data as { taskId: string }).taskId;
      }
    }

    setTasks((previous) =>
      selectedTask
        ? previous.map((task) => (task.id === selectedTask.id ? newTask : task))
        : [newTask, ...previous],
    );
    setSelectedTask(null);
    setActiveSheet(null);
    router.refresh();
  };

  const deleteSelectedSchedule = async () => {
    if (selectedSchedule) {
      if (usesSupabaseData) {
        const result = await deleteScheduleAction(selectedSchedule);

        if (!result.ok) {
          window.alert(result.message);
          return;
        }
      }

      setSchedules((previous) => previous.filter((schedule) => schedule.id !== selectedSchedule.id));
    }
    setSelectedSchedule(null);
    setDeleteScheduleOpen(false);
    setActiveSheet(null);
    router.refresh();
  };

  const deleteTask = async (taskId: string) => {
    if (usesSupabaseData) {
      const result = await deletePreliminaryTaskAction(taskId);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    router.refresh();
  };

  const editTask = (task: PreliminaryTask) => {
    setSelectedTask(task);
    setActiveSheet('preliminaryTask');
  };

  const toggleTaskCompleted = async (taskId: string, isCompleted: boolean) => {
    const previousTasks = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, isCompleted } : task)));

    if (usesSupabaseData) {
      const result = await updatePreliminaryTaskCompletedAction({ taskId, isCompleted });

      if (!result.ok) {
        setTasks(previousTasks);
        window.alert(result.message);
        return;
      }
    }

    router.refresh();
  };

  const toggleScheduleChecked = async (scheduleId: string, isChecked: boolean) => {
    const previousSchedules = schedules;
    setSchedules((current) =>
      current.map((schedule) => (schedule.id === scheduleId ? { ...schedule, isChecked } : schedule)),
    );

    if (usesSupabaseData) {
      const result = await updateScheduleCheckedAction({ scheduleId, isChecked });

      if (!result.ok) {
        setSchedules(previousSchedules);
        window.alert(result.message);
        return;
      }
    }

    router.refresh();
  };

  const deleteSchedule = async (scheduleId: string) => {
    const schedule = schedules.find((candidate) => candidate.id === scheduleId);

    if (!schedule) {
      return;
    }

    if (usesSupabaseData) {
      const result = await deleteScheduleAction(schedule);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setSchedules((previous) => previous.filter((candidate) => candidate.id !== scheduleId));
    router.refresh();
  };

  const deleteRoom = async (targetRoomId: string) => {
    if (usesSupabaseData) {
      const result = await deleteRoomAction(targetRoomId);

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setRooms((previous) => previous.filter((room) => room.id !== targetRoomId));
    setSchedules((previous) => previous.filter((schedule) => schedule.roomId !== targetRoomId));
    setTasks((previous) => previous.map((task) => (task.roomId === targetRoomId ? { ...task, roomId: null } : task)));
    setDeleteRoomOpen(false);
    setActiveSheet(null);
    router.push('/dashboard');
    router.refresh();
  };

  const updateScheduleStatus = async (scheduleId: string, status: Schedule['status']) => {
    const schedule = schedules.find((candidate) => candidate.id === scheduleId);

    if (!schedule) {
      return;
    }

    if (usesSupabaseData) {
      const result = await updateScheduleStatusAction({ id: scheduleId, roomId: schedule.roomId, status });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setSchedules((previous) =>
      previous.map((candidate) =>
        candidate.id === scheduleId ? { ...candidate, status, updatedAt: new Date().toISOString() } : candidate,
      ),
    );
    router.refresh();
  };

  const changeMemberRole = async (targetRoomId: string, memberId: string, role: RoomMember['role']) => {
    if (usesSupabaseData) {
      const result = await updateMemberRoleAction({ roomId: targetRoomId, memberId, role });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setRooms((previous) =>
      previous.map((room) =>
        room.id === targetRoomId
          ? {
              ...room,
              members: room.members.map((member) => (member.id === memberId ? { ...member, role } : member)),
              recentActivity: '권한 변경',
            }
          : room,
      ),
    );
    router.refresh();
  };

  const kickMember = async (targetRoomId: string, memberId: string) => {
    if (usesSupabaseData) {
      const result = await kickMemberAction({ roomId: targetRoomId, memberId });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setRooms((previous) =>
      previous.map((room) =>
        room.id === targetRoomId
          ? { ...room, members: room.members.filter((member) => member.id !== memberId), recentActivity: '참여자 변경' }
          : room,
      ),
    );
    setSchedules((previous) =>
      previous.map((schedule) =>
        schedule.roomId === targetRoomId
          ? { ...schedule, participantMemberIds: schedule.participantMemberIds.filter((id) => id !== memberId) }
          : schedule,
      ),
    );
    router.refresh();
  };

  const transferOwnership = async (targetRoomId: string, targetMemberId: string) => {
    if (usesSupabaseData) {
      const result = await transferOwnershipAction({ roomId: targetRoomId, memberId: targetMemberId });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setRooms((previous) =>
      previous.map((room) => {
        if (room.id !== targetRoomId) {
          return room;
        }

        const targetMember = room.members.find((member) => member.id === targetMemberId);

        if (!targetMember) {
          return room;
        }

        return {
          ...room,
          ownerUserId: targetMember.userId,
          recentActivity: '방장 위임',
          members: room.members.map((member) => {
            if (member.id === targetMemberId) {
              return { ...member, role: 'owner' };
            }

            if (member.role === 'owner') {
              return { ...member, role: 'manager' };
            }

            return member;
          }),
        };
      }),
    );
    setTransferConfirmed(false);
    setActiveSheet(null);
    router.refresh();
  };

  const saveProfile = async (values: ProfileFormValues) => {
    if (usesSupabaseData) {
      const result = await updateProfileAction({
        name: values.name.trim() || workspaceProfile.name,
        phone: values.phone.trim() || null,
      });

      if (!result.ok) {
        window.alert(result.message);
        return;
      }
    }

    setWorkspaceProfile((previous) => ({
      ...previous,
      name: values.name.trim() || previous.name,
      phone: values.phone.trim() || null,
    }));
    router.refresh();
  };

  const savePassword = async (values: PasswordFormValues) => {
    if (values.password.length < 12) {
      return { ok: false, message: '비밀번호는 12자 이상이어야 합니다.' };
    }

    if (!/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password) || !/[^A-Za-z0-9]/.test(values.password)) {
      return { ok: false, message: '비밀번호에는 대문자, 소문자, 숫자, 특수문자가 모두 포함되어야 합니다.' };
    }

    if (values.password !== values.passwordConfirm) {
      return { ok: false, message: '비밀번호가 일치하지 않습니다.' };
    }

    if (usesSupabaseData) {
      const result = await updateCurrentPasswordAction({ password: values.password });

      if (!result.ok) {
        return { ok: false, message: result.message };
      }
    }

    return { ok: true, message: '비밀번호를 변경했습니다.' };
  };

  const savePreferences = async (values: UserPreferenceFormValues) => {
    const nextPreference: UserPreference = {
      userId: workspaceProfile.id,
      pushEnabled: values.pushEnabled,
      defaultCalendarView: values.defaultCalendarView,
      filterOpacity: Math.min(Math.max(Math.round(values.filterOpacity), 0), 100),
    };

    if (usesSupabaseData) {
      const result = await updateUserPreferencesAction(nextPreference);

      if (!result.ok) {
        return { ok: false, message: result.message };
      }
    }

    setPreference(nextPreference);
    router.refresh();
    return { ok: true, message: '화면 설정을 저장했습니다.' };
  };

  const previewInvite = async (invite: string): Promise<
    | { ok: true; data: InvitePreview }
    | { ok: false; message: string }
  > => {
    const token = inviteTokenFromInput(invite);
    if (!token) return { ok: false as const, message: '올바른 초대 링크를 입력해주세요.' };
    try {
      const response = await fetch(`/api/invites/${encodeURIComponent(token)}`);
      const result = await response.json() as Partial<InvitePreview> & { result?: string };
      if (!response.ok || result.result !== 'active') {
        return { ok: false as const, message: '초대를 사용할 수 없습니다. 새 링크를 요청해주세요.' };
      }
      return { ok: true as const, data: result as InvitePreview };
    } catch {
      return { ok: false as const, message: '초대 링크를 확인하지 못했습니다. 다시 시도해주세요.' };
    }
  };

  return (
    <AppFrame>
      {page === 'dashboard' ? (
        <DashboardView
          profile={workspaceProfile}
          rooms={rooms}
          calendarSchedules={dashboardCalendarSchedules}
          todaySchedules={todaySchedules}
          tasks={tasks}
          onCreateRoom={() => setActiveSheet('createRoom')}
          onJoinRoom={() => setActiveSheet('joinRoom')}
          onOpenSchedule={openScheduleDetail}
          onToggleScheduleChecked={toggleScheduleChecked}
          onConvertTask={convertTaskToSchedule}
          onDeleteTask={deleteTask}
          onEditTask={editTask}
          onToggleTaskCompleted={toggleTaskCompleted}
          onAddTask={() => {
            setSelectedTask(null);
            setActiveSheet('preliminaryTask');
          }}
        />
      ) : null}

      {page === 'todayTasks' ? (
        <TodayTasksView
          profile={workspaceProfile}
          rooms={rooms}
          schedules={todaySchedules}
          onOpenSchedule={openScheduleDetail}
          onToggleScheduleChecked={toggleScheduleChecked}
        />
      ) : null}

      {page === 'preliminaryTasks' ? (
        <PreliminaryTasksView
          rooms={rooms}
          tasks={tasks}
          onAddTask={() => {
            setSelectedTask(null);
            setActiveSheet('preliminaryTask');
          }}
          onConvertTask={convertTaskToSchedule}
          onEditTask={editTask}
          onDeleteTask={deleteTask}
          onToggleTaskCompleted={toggleTaskCompleted}
        />
      ) : null}

      {page === 'rooms' ? (
        <RoomsView
          profile={workspaceProfile}
          rooms={filteredRooms}
          roomSearch={roomSearch}
          roleFilter={roomRoleFilter}
          sortMode={sortMode}
          onSearch={setRoomSearch}
          onRoleFilter={setRoomRoleFilter}
          onSort={setSortMode}
          onCreateRoom={() => setActiveSheet('createRoom')}
          onJoinRoom={() => setActiveSheet('joinRoom')}
        />
      ) : null}

      {page === 'room' ? (
        <RoomDetailView
          room={activeRoom}
          profile={workspaceProfile}
          schedules={visibleRoomSchedules}
          onOpenMenu={() => setActiveSheet('roomMenu')}
          onOpenSchedule={openScheduleDetail}
        />
      ) : null}

      {page === 'mypage' ? (
        <MyPageView
          profile={workspaceProfile}
          preference={preference}
          rooms={rooms}
          onSaveProfile={saveProfile}
          onSavePassword={savePassword}
          onSavePreferences={savePreferences}
        />
      ) : null}

      <CreateRoomSheet open={activeSheet === 'createRoom'} onClose={() => setActiveSheet(null)} onSubmit={addDemoRoom} />
      <CreateRoomCompleteSheet
        open={activeSheet === 'createComplete'}
        room={createdRoom ?? rooms[0] ?? emptyRoom}
        onClose={() => setActiveSheet(null)}
        onOpenRoom={(targetRoomId) => {
          setActiveSheet(null);
          router.push(`/rooms/${targetRoomId}`);
        }}
      />
      <JoinRoomSheet
        open={activeSheet === 'joinRoom'}
        onClose={() => setActiveSheet(null)}
        onPreview={previewInvite}
        onSubmit={joinDemoRoom}
      />
      <RoomMenuSheet
        open={activeSheet === 'roomMenu'}
        room={activeRoom}
        profile={workspaceProfile}
        onClose={() => setActiveSheet(null)}
        onScheduleAdd={() => {
          setSelectedSchedule(null);
          setSelectedTask(null);
          setActiveSheet('scheduleForm');
        }}
        onParticipants={() => setActiveSheet('participantManagement')}
        onTransfer={() => setActiveSheet('transferOwnership')}
        onManagement={() => setActiveSheet('roomScheduleManagement')}
        onInvite={() => setActiveSheet('inviteInfo')}
        onInfo={() => setActiveSheet('roomInfo')}
        onDelete={() => {
          setActiveSheet(null);
          setDeleteRoomOpen(true);
        }}
      />
      <ScheduleFormSheet
        open={activeSheet === 'scheduleForm'}
        room={formRoom}
        schedule={selectedSchedule}
        currentUser={workspaceProfile}
        task={selectedTask}
        onClose={() => {
          setSelectedSchedule(null);
          setSelectedTask(null);
          setActiveSheet(null);
        }}
        onSubmit={addDemoSchedule}
      />
      <ScheduleDetailSheet
        open={activeSheet === 'scheduleDetail'}
        schedule={selectedSchedule}
        room={selectedSchedule ? rooms.find((room) => room.id === selectedSchedule.roomId) ?? activeRoom : activeRoom}
        profile={workspaceProfile}
        onClose={() => setActiveSheet(null)}
        onEdit={() => setActiveSheet('scheduleForm')}
        onDelete={() => setDeleteScheduleOpen(true)}
      />
      <ParticipantManagementSheet
        open={activeSheet === 'participantManagement'}
        room={activeRoom}
        onClose={() => setActiveSheet(null)}
        onTransfer={() => setActiveSheet('transferOwnership')}
        onRoleChange={(memberId, role) => changeMemberRole(activeRoom.id, memberId, role)}
        onKick={(memberId) => kickMember(activeRoom.id, memberId)}
      />
      <TransferOwnershipSheet
        open={activeSheet === 'transferOwnership'}
        room={activeRoom}
        checked={transferConfirmed}
        onCheckedChange={setTransferConfirmed}
        onConfirm={(memberId) => transferOwnership(activeRoom.id, memberId)}
        onClose={() => {
          setTransferConfirmed(false);
          setActiveSheet(null);
        }}
      />
      <RoomScheduleManagementSheet
        open={activeSheet === 'roomScheduleManagement'}
        room={activeRoom}
        schedules={visibleRoomSchedules}
        onClose={() => setActiveSheet(null)}
        onOpenSchedule={openScheduleDetail}
        onEditSchedule={(schedule) => {
          setSelectedSchedule(schedule);
          setActiveSheet('scheduleForm');
        }}
        onDeleteSchedule={deleteSchedule}
        onStatusChange={updateScheduleStatus}
      />
      <PreliminaryTaskSheet
        open={activeSheet === 'preliminaryTask'}
        rooms={rooms}
        task={selectedTask}
        onClose={() => {
          setSelectedTask(null);
          setActiveSheet(null);
        }}
        onSubmit={addPreliminaryTask}
      />
      <RoomInvitePanel
        open={activeSheet === 'inviteInfo'}
        roomId={activeRoom.id}
        onClose={() => setActiveSheet(null)}
      />
      <RoomInfoSheet open={activeSheet === 'roomInfo'} room={activeRoom} onClose={() => setActiveSheet(null)} />
      <ConfirmDialog
        open={deleteScheduleOpen}
        title="이 일정을 삭제하시겠습니까?"
        description="삭제한 일정은 복구할 수 없습니다."
        confirmLabel="삭제"
        danger
        onClose={() => setDeleteScheduleOpen(false)}
        onConfirm={deleteSelectedSchedule}
      />
      <ConfirmDialog
        open={deleteRoomOpen}
        title="이 방을 삭제하시겠습니까?"
        description="방을 삭제하면 참여자, 초대 링크, 일정이 함께 삭제됩니다. 삭제한 방은 복구할 수 없습니다."
        confirmLabel="방 삭제"
        danger
        onClose={() => setDeleteRoomOpen(false)}
        onConfirm={() => deleteRoom(activeRoom.id)}
      />
    </AppFrame>
  );
}

function DashboardView({
  profile,
  rooms,
  calendarSchedules,
  todaySchedules,
  tasks,
  onCreateRoom,
  onJoinRoom,
  onOpenSchedule,
  onToggleScheduleChecked,
  onConvertTask,
  onDeleteTask,
  onEditTask,
  onToggleTaskCompleted,
  onAddTask,
}: {
  profile: Profile;
  rooms: SchedulingRoom[];
  calendarSchedules: Schedule[];
  todaySchedules: Schedule[];
  tasks: PreliminaryTask[];
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenSchedule: (schedule: Schedule) => void;
  onToggleScheduleChecked: (scheduleId: string, isChecked: boolean) => void;
  onConvertTask: (task: PreliminaryTask) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: PreliminaryTask) => void;
  onToggleTaskCompleted: (taskId: string, isCompleted: boolean) => void;
  onAddTask: () => void;
}) {
  const [visibleRoomCount, setVisibleRoomCount] = useState(2);
  const [visibleScheduleCount, setVisibleScheduleCount] = useState(3);
  const [visibleTaskCount, setVisibleTaskCount] = useState(2);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const visibleRooms = rooms.slice(0, visibleRoomCount);
  const visibleSchedules = todaySchedules.slice(0, visibleScheduleCount);
  const visibleTasks = tasks.slice(0, visibleTaskCount);
  const hiddenRoomCount = Math.max(rooms.length - visibleRoomCount, 0);
  const hiddenScheduleCount = Math.max(todaySchedules.length - visibleScheduleCount, 0);
  const hiddenTaskCount = Math.max(tasks.length - visibleTaskCount, 0);
  const myCalendarRoom = useMemo(() => buildMyCalendarRoom(profile, rooms), [profile, rooms]);

  return (
    <div className="space-y-6">
      <AppHeader profile={profile} subtitle="오늘의 일정과 할 일을 확인하세요." />
      <section className="grid grid-cols-2 gap-3">
        <Button type="button" onClick={onCreateRoom}>
          <Plus className="h-4 w-4" />
          새 방 만들기
        </Button>
        <Button type="button" variant="outline" onClick={onJoinRoom}>
          <UserPlus className="h-4 w-4" />
          방 참여하기
        </Button>
      </section>
      <SectionHeader title="참여 중인 스케줄링" href="/rooms" />
      <div className="space-y-3">
        {rooms.length > 0 ? (
          visibleRooms.map((room) => (
            <RoomCard key={room.id} room={room} currentUser={profile} />
          ))
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="min-h-32 rounded-2xl border border-app-border bg-white p-4 text-left shadow-sm"
              onClick={onCreateRoom}
            >
              <Plus className="mb-3 h-5 w-5 text-app-blue" />
              <p className="font-black text-gray-950">새 방 만들기</p>
              <p className="mt-1 text-xs text-gray-500">팀 일정을 공유할 방을 시작하세요.</p>
            </button>
            <button
              type="button"
              className="min-h-32 rounded-2xl border border-app-border bg-white p-4 text-left shadow-sm"
              onClick={onJoinRoom}
            >
              <UserPlus className="mb-3 h-5 w-5 text-app-blue" />
              <p className="font-black text-gray-950">방 참여하기</p>
              <p className="mt-1 text-xs text-gray-500">초대 코드로 기존 방에 들어가세요.</p>
            </button>
          </div>
        )}
        {hiddenRoomCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setVisibleRoomCount((count) => count + 2)}
          >
            <Plus className="h-4 w-4" />
            {Math.min(hiddenRoomCount, 2)}개 더 보기
          </Button>
        ) : null}
      </div>
      <SectionHeader title="내 달력" />
      <ScheduleCalendar
        room={myCalendarRoom}
        schedules={calendarSchedules}
        currentUser={profile}
        onScheduleClick={onOpenSchedule}
        compact={!isCalendarExpanded}
        timeTableAction={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCalendarExpanded((expanded) => !expanded)}
          >
            {isCalendarExpanded ? '간략히보기' : '전체보기'}
          </Button>
        }
      />
      <SectionHeader title="오늘 할 일" href="/dashboard/today" />
      <div className="space-y-3">
        {todaySchedules.length > 0 ? (
          visibleSchedules.map((schedule) => {
            const room = rooms.find((candidate) => candidate.id === schedule.roomId) ?? rooms[0];
            return (
              <TodayTaskCard
                key={schedule.id}
                schedule={schedule}
                room={room}
                onOpen={() => onOpenSchedule(schedule)}
                onToggleChecked={(checked) => onToggleScheduleChecked(schedule.id, checked)}
              />
            );
          })
        ) : (
          <EmptyState title="오늘 할 일이 없습니다" description="내게 배정된 일정이 여기에 표시됩니다." />
        )}
        {hiddenScheduleCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setVisibleScheduleCount((count) => count + 2)}
          >
            <Plus className="h-4 w-4" />
            {Math.min(hiddenScheduleCount, 2)}개 더 보기
          </Button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title="예비 할 일" href="/dashboard/preliminary" />
        <Button type="button" size="sm" onClick={onAddTask}>
          <Plus className="h-4 w-4" />
          추가
        </Button>
      </div>
      <div className="space-y-3">
        {tasks.length > 0 ? (
          visibleTasks.map((task) => (
            <PreliminaryTaskCard
              key={task.id}
              task={task}
              room={rooms.find((room) => room.id === task.roomId)}
              onConvert={() => onConvertTask(task)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
              onToggleCompleted={(checked) => onToggleTaskCompleted(task.id, checked)}
            />
          ))
        ) : (
          <EmptyState title="예비 할 일이 없습니다" description="날짜가 정해지지 않은 할 일이 여기에 표시됩니다." />
        )}
        {hiddenTaskCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setVisibleTaskCount((count) => count + 2)}
          >
            <Plus className="h-4 w-4" />
            {Math.min(hiddenTaskCount, 2)}개 더 보기
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TodayTasksView({
  profile,
  rooms,
  schedules,
  onOpenSchedule,
  onToggleScheduleChecked,
}: {
  profile: Profile;
  rooms: SchedulingRoom[];
  schedules: Schedule[];
  onOpenSchedule: (schedule: Schedule) => void;
  onToggleScheduleChecked: (scheduleId: string, isChecked: boolean) => void;
}) {
  const myCalendarRoom = useMemo(() => buildMyCalendarRoom(profile, rooms), [profile, rooms]);

  return (
    <div className="space-y-5">
      <BackHeader title="오늘 할 일" description="참여 중인 모든 방에서 내게 배정된 일정을 모았습니다." />
      <ScheduleCalendar room={myCalendarRoom} schedules={schedules} currentUser={profile} onScheduleClick={onOpenSchedule} />
      <div className="space-y-3">
        {schedules.length > 0 ? (
          schedules.map((schedule) => {
            const room = rooms.find((candidate) => candidate.id === schedule.roomId) ?? rooms[0];
            return (
              <TodayTaskCard
                key={schedule.id}
                schedule={schedule}
                room={room}
                onOpen={() => onOpenSchedule(schedule)}
                onToggleChecked={(checked) => onToggleScheduleChecked(schedule.id, checked)}
              />
            );
          })
        ) : (
          <EmptyState title="오늘 할 일이 없습니다" description="내게 배정된 일정이 여기에 표시됩니다." />
        )}
      </div>
    </div>
  );
}

function PreliminaryTasksView({
  rooms,
  tasks,
  onAddTask,
  onConvertTask,
  onEditTask,
  onDeleteTask,
  onToggleTaskCompleted,
}: {
  rooms: SchedulingRoom[];
  tasks: PreliminaryTask[];
  onAddTask: () => void;
  onConvertTask: (task: PreliminaryTask) => void;
  onEditTask: (task: PreliminaryTask) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTaskCompleted: (taskId: string, isCompleted: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackHeader title="예비 할 일" description="아직 날짜가 정해지지 않은 개인 할 일을 관리합니다." />
        <Button type="button" size="icon" onClick={onAddTask} aria-label="예비 할 일 추가">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <PreliminaryTaskCard
              key={task.id}
              task={task}
              room={rooms.find((room) => room.id === task.roomId)}
              onConvert={() => onConvertTask(task)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
              onToggleCompleted={(checked) => onToggleTaskCompleted(task.id, checked)}
            />
          ))
        ) : (
          <EmptyState title="예비 할 일이 없습니다" description="추가 버튼으로 할 일을 등록하세요." />
        )}
      </div>
    </div>
  );
}

function RoomsView({
  profile,
  rooms,
  roomSearch,
  roleFilter,
  sortMode,
  onSearch,
  onRoleFilter,
  onSort,
  onCreateRoom,
  onJoinRoom,
}: {
  profile: Profile;
  rooms: SchedulingRoom[];
  roomSearch: string;
  roleFilter: 'all' | RoomMember['role'];
  sortMode: 'recent' | 'name';
  onSearch: (value: string) => void;
  onRoleFilter: (value: 'all' | RoomMember['role']) => void;
  onSort: (value: 'recent' | 'name') => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}) {
  return (
    <div className="space-y-5">
      <BackHeader title="참여 중인 방" />
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          value={roomSearch}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="방 검색"
          className="h-11 w-full rounded-xl border border-app-border bg-white pl-9 pr-3 text-sm outline-none focus:border-app-blue focus:ring-4 focus:ring-blue-100"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {(['all', 'owner', 'manager', 'member', 'viewer'] as const).map((role) => (
          <button
            key={role}
            type="button"
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold capitalize',
              roleFilter === role ? 'border-app-blue bg-app-blue text-white' : 'border-app-border bg-white text-gray-600',
            )}
            onClick={() => onRoleFilter(role)}
          >
            {role === 'all' ? '전체' : roomRoleLabels[role]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant={sortMode === 'recent' ? 'primary' : 'outline'} onClick={() => onSort('recent')}>
          최근순
        </Button>
        <Button type="button" variant={sortMode === 'name' ? 'primary' : 'outline'} onClick={() => onSort('name')}>
          이름
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" onClick={onCreateRoom}>
          <Plus className="h-4 w-4" />
          새 방 만들기
        </Button>
        <Button type="button" variant="outline" onClick={onJoinRoom}>
          <UserPlus className="h-4 w-4" />
          방 참여하기
        </Button>
      </div>
      <div className="space-y-3">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} currentUser={profile} />
        ))}
      </div>
    </div>
  );
}

function RoomDetailView({
  room,
  profile,
  schedules,
  onOpenMenu,
  onOpenSchedule,
}: {
  room: SchedulingRoom;
  profile: Profile;
  schedules: Schedule[];
  onOpenMenu: () => void;
  onOpenSchedule: (schedule: Schedule) => void;
}) {
  const member = getMyMember(room, profile);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackHeader title={room.name} description={`내 닉네임: ${member?.nickname ?? '-'}`} />
        <Button type="button" variant="outline" size="icon" onClick={onOpenMenu} aria-label="방 메뉴">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
      <Card className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {member ? <RoleBadge role={member.role} /> : null}
            <span className="text-xs font-semibold text-gray-500">{room.members.length}명</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">{room.description}</p>
        </div>
        <ParticipantAvatarGroup members={room.members} />
      </Card>
      <ScheduleCalendar room={room} schedules={schedules} currentUser={profile} onScheduleClick={onOpenSchedule} />
      <button
        type="button"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+96px)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-app-blue text-white shadow-lg md:right-[calc(50%_-_344px)]"
        onClick={onOpenMenu}
        aria-label="방 기능 열기"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

function MyPageView({
  profile,
  preference,
  rooms,
  onSaveProfile,
  onSavePassword,
  onSavePreferences,
}: {
  profile: Profile;
  preference: UserPreference;
  rooms: SchedulingRoom[];
  onSaveProfile: (values: ProfileFormValues) => void;
  onSavePassword: (values: PasswordFormValues) => Promise<{ ok: boolean; message: string }>;
  onSavePreferences: (values: UserPreferenceFormValues) => Promise<{ ok: boolean; message: string }>;
}) {
  const owned = rooms.filter((room) => getMyMember(room, profile)?.role === 'owner').length;
  const managed = rooms.filter((room) => getMyMember(room, profile)?.role === 'manager').length;
  const member = rooms.filter((room) => getMyMember(room, profile)?.role === 'member').length;
  const [savedMessage, setSavedMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [preferenceMessage, setPreferenceMessage] = useState('');

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSaveProfile({
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
    });
    setSavedMessage('내 정보를 저장했습니다.');
  };

  const handlePasswordSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = await onSavePassword({
      password: String(formData.get('password') ?? ''),
      passwordConfirm: String(formData.get('passwordConfirm') ?? ''),
    });

    setPasswordMessage(result.message);

    if (result.ok) {
      form.reset();
    }
  };

  const handlePreferenceSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const view = String(formData.get('defaultCalendarView') ?? preference.defaultCalendarView);
    const result = await onSavePreferences({
      defaultCalendarView: view === 'month' ? 'month' : 'week',
      filterOpacity: Number(formData.get('filterOpacity') ?? preference.filterOpacity),
      pushEnabled: formData.get('pushEnabled') === 'on',
    });

    setPreferenceMessage(result.message);
  };

  return (
    <div className="space-y-5">
      <AppHeader profile={profile} subtitle="내 정보와 참여 중인 방을 관리하세요." />
      <Card>
        <h2 className="font-black text-gray-950">{profile.name}</h2>
        <p className="mt-1 text-sm text-gray-500">{profile.email}</p>
        <div className="mt-4 flex gap-2">
          {profile.isServiceAdmin ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">서비스 관리자</span> : null}
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{accountStatusLabels[profile.status]}</span>
        </div>
      </Card>
      <Card>
        <h3 className="font-black text-gray-950">내 정보</h3>
        <form className="mt-3 space-y-3" onSubmit={handleSave}>
          <Field label="이름" name="name" defaultValue={profile.name} />
          <Field label="전화번호" name="phone" defaultValue={profile.phone ?? ''} />
          {savedMessage ? <p className="text-xs font-semibold text-app-blue">{savedMessage}</p> : null}
          <Button type="submit" className="w-full">내 정보 저장</Button>
        </form>
      </Card>
      <Card>
        <h3 className="font-black text-gray-950">비밀번호 변경</h3>
        <form className="mt-3 space-y-3" onSubmit={handlePasswordSave}>
          <Field label="새 비밀번호" name="password" type="password" placeholder="12자 이상, 대소문자·숫자·특수문자 포함" required />
          <Field label="새 비밀번호 확인" name="passwordConfirm" type="password" placeholder="비밀번호를 다시 입력" required />
          {passwordMessage ? (
            <p className={cn('text-xs font-semibold', passwordMessage.includes('변경했습니다') ? 'text-app-blue' : 'text-app-danger')}>
              {passwordMessage}
            </p>
          ) : null}
          <Button type="submit" className="w-full">비밀번호 변경</Button>
        </form>
      </Card>
      <Card>
        <h3 className="font-black text-gray-950">일정 및 화면 설정</h3>
        <form className="mt-4 space-y-4" onSubmit={handlePreferenceSave}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-gray-700">기본 보기</span>
            <select
              name="defaultCalendarView"
              defaultValue={preference.defaultCalendarView}
              className="h-11 w-full rounded-xl border border-app-border bg-white px-3 text-sm outline-none focus:border-app-blue focus:ring-4 focus:ring-blue-100"
            >
              <option value="week">주간</option>
              <option value="month">월간</option>
            </select>
          </label>
          <Field
            label="필터 투명도"
            name="filterOpacity"
            type="number"
            min={0}
            max={100}
            defaultValue={preference.filterOpacity}
          />
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-app-border bg-white px-3 text-sm font-semibold text-gray-700">
            <input type="checkbox" name="pushEnabled" defaultChecked={preference.pushEnabled} />
            알림 사용
          </label>
          {preferenceMessage ? <p className="text-xs font-semibold text-app-blue">{preferenceMessage}</p> : null}
          <Button type="submit" className="w-full">화면 설정 저장</Button>
        </form>
      </Card>
      <Card>
        <h3 className="font-black text-gray-950">내 스케줄링 방</h3>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          <Stat label="전체" value={rooms.length} />
          <Stat label="방장" value={owned} />
          <Stat label="매니저" value={managed} />
          <Stat label="참여자" value={member} />
        </div>
      </Card>
      <div className="space-y-3">
        {rooms.map((room) => {
          const myMember = getMyMember(room, profile);
          return (
            <Card key={room.id} className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-950">{room.name}</p>
                <p className="mt-1 text-xs text-gray-500">방 닉네임: {myMember?.nickname}</p>
              </div>
              <div className="flex items-center gap-2">
                {myMember ? <RoleBadge role={myMember.role} /> : null}
                <Link href={`/rooms/${room.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-app-blue">
                  열기
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
      {profile.isServiceAdmin ? (
        <Link href="/admin" className="block">
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-black text-gray-950">관리자 설정</p>
              <p className="text-xs text-gray-500">서비스 계정을 관리합니다.</p>
            </div>
            <Shield className="h-5 w-5 text-app-blue" />
          </Card>
        </Link>
      ) : null}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-black text-gray-950">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex min-h-11 items-center text-sm font-bold text-app-blue">
          전체 보기
        </Link>
      ) : null}
    </div>
  );
}

function BackHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Link href="/dashboard" className="flex h-11 w-11 items-center justify-center rounded-full border border-app-border bg-white">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div>
        <h1 className="text-2xl font-black text-gray-950">{title}</h1>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-lg font-black text-gray-950">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

function CreateRoomSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateRoomFormValues) => Promise<void>;
}) {
  const formId = 'create-room-form';
  const [timeError, setTimeError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTimeError('');

    const formData = new FormData(event.currentTarget);
    const values: CreateRoomFormValues = {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      nickname: String(formData.get('nickname') ?? ''),
      color: String(formData.get('color') ?? '#3558e6'),
      sharedScheduleColor: String(formData.get('sharedScheduleColor') ?? '#8b6ff4'),
      defaultView: String(formData.get('defaultView') ?? 'week') === 'month' ? 'month' : 'week',
      businessStartTime: String(formData.get('businessStartTime') ?? '09:00'),
      businessEndTime: String(formData.get('businessEndTime') ?? '18:00'),
    };

    const startAt = new Date(`2026-07-02T${values.businessStartTime}:00+09:00`);
    const endAt = new Date(`2026-07-02T${values.businessEndTime}:00+09:00`);

    if (endAt <= startAt) {
      setTimeError('업무 종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    await onSubmit(values);
  };

  return (
    <Sheet
      open={open}
      title="스케줄링 방 만들기"
      description="방 정보, 내 닉네임, 색상, 업무 시간을 설정하세요."
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" form={formId}>방 만들기</Button>
        </div>
      }
    >
      <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
        <Field label="방 이름" name="name" placeholder="천안 청소팀" required />
        <TextareaField label="방 설명" name="description" placeholder="스케줄링 방 설명을 입력하세요" />
        <Field label="방에서 사용할 내 닉네임" name="nickname" placeholder="민수" required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="방 대표 색상" name="color" type="color" defaultValue="#3558e6" className="p-1" />
          <Field label="공동 일정 색상" name="sharedScheduleColor" type="color" defaultValue="#8b6ff4" className="p-1" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700">기본 보기</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white text-sm font-bold text-gray-700">
              <input type="radio" name="defaultView" value="week" defaultChecked />
              주간
            </label>
            <label className="flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white text-sm font-bold text-gray-700">
              <input type="radio" name="defaultView" value="month" />
              월간
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="업무 시작" name="businessStartTime" type="time" defaultValue="09:00" required />
          <Field label="업무 종료" name="businessEndTime" type="time" defaultValue="18:00" required />
        </div>
        {timeError ? <p className="text-xs font-semibold text-app-danger">{timeError}</p> : null}
      </form>
    </Sheet>
  );
}

function CreateRoomCompleteSheet({
  open,
  room,
  onClose,
  onOpenRoom,
}: {
  open: boolean;
  room: SchedulingRoom;
  onClose: () => void;
  onOpenRoom: (roomId: string) => void;
}) {
  const ownerMember = room.members.find((member) => member.role === 'owner');

  return (
    <Sheet open={open} title="방 생성 완료" description="참여자에게 초대 정보를 공유하세요." onClose={onClose}>
      <div className="space-y-4">
        <Card>
          <p className="font-black text-gray-950">{room.name}</p>
          <p className="mt-1 text-sm text-gray-500">내 닉네임: {ownerMember?.nickname ?? '-'}</p>
          <p className="mt-1 text-sm text-gray-500">내 권한: 방장</p>
        </Card>
        <Card className="space-y-2">
          <p className="text-sm font-bold text-gray-900">초대 링크는 방 메뉴에서 발급할 수 있습니다.</p>
          <p className="text-xs text-gray-500">권한, 만료 일시, 사용 횟수를 지정한 뒤 필요한 사람에게만 공유하세요.</p>
        </Card>
        <Card className="space-y-2 text-sm text-gray-600">
          <p><span className="font-bold text-gray-900">기본 보기:</span> {room.defaultView === 'week' ? '주간' : '월간'}</p>
          <p><span className="font-bold text-gray-900">업무 시간:</span> {room.businessStartTime} - {room.businessEndTime}</p>
          <p><span className="font-bold text-gray-900">참여자:</span> {room.members.length}명</p>
        </Card>
        <Button type="button" className="w-full" onClick={() => onOpenRoom(room.id)}>방으로 이동</Button>
      </div>
    </Sheet>
  );
}

function JoinRoomSheet({
  open,
  onClose,
  onPreview,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onPreview: (invite: string) => Promise<
    | { ok: true; data: InvitePreview }
    | { ok: false; message: string }
  >;
  onSubmit: (values: JoinRoomFormValues) => Promise<{ ok: boolean; message: string }>;
}) {
  const formId = 'join-room-form';
  const [invite, setInvite] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handlePreview = async () => {
    setMessage('');
    setPreview(null);
    setIsPreviewing(true);

    const result = await onPreview(invite);

    if (result.ok) {
      setPreview(result.data);
    } else {
      setMessage(result.message);
    }

    setIsPreviewing(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const formData = new FormData(event.currentTarget);
    const result = await onSubmit({
      invite: String(formData.get('invite') ?? ''),
      nickname: String(formData.get('nickname') ?? ''),
    });

    if (!result.ok) {
      setMessage(result.message);
    }
  };

  return (
    <Sheet
      open={open}
      title="스케줄링 방 참여"
      description="발급받은 제한형 초대 링크를 입력하세요."
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" form={formId}>방 참여하기</Button>
        </div>
      }
    >
      <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
        <Field
          label="초대 링크"
          name="invite"
          value={invite}
          onChange={(event) => {
            setInvite(event.target.value);
            setPreview(null);
            setMessage('');
          }}
          placeholder="https://example.com/join/..."
          required
        />
        <Button type="button" variant="outline" className="w-full" onClick={handlePreview} disabled={!invite.trim() || isPreviewing}>
          {isPreviewing ? '링크 확인 중' : '링크 확인'}
        </Button>
        {preview ? (
          <Card>
            <p className="font-black text-gray-950">{preview.roomName}</p>
            <p className="mt-1 text-sm text-gray-500">{preview.roomDescription ?? '방 설명이 없습니다.'}</p>
            <p className="mt-2 text-xs font-semibold text-gray-500">
              초대한 사람: {preview.inviterDisplayName} · 권한: {preview.grantRole === 'viewer' ? '보기 전용' : '구성원'}
            </p>
            <p className="mt-1 text-xs text-gray-500">만료: {new Date(preview.expiresAt).toLocaleString('ko-KR')}</p>
          </Card>
        ) : null}
        <Field label="방에서 사용할 닉네임" name="nickname" placeholder="민수" required />
        {message ? <p className="text-xs font-semibold text-app-danger">{message}</p> : null}
      </form>
    </Sheet>
  );
}

function RoomMenuSheet({
  open,
  room,
  profile,
  onClose,
  onScheduleAdd,
  onParticipants,
  onTransfer,
  onManagement,
  onInvite,
  onInfo,
  onDelete,
}: {
  open: boolean;
  room: SchedulingRoom;
  profile: Profile;
  onClose: () => void;
  onScheduleAdd: () => void;
  onParticipants: () => void;
  onTransfer: () => void;
  onManagement: () => void;
  onInvite: () => void;
  onInfo: () => void;
  onDelete: () => void;
}) {
  const myMember = getMyMember(room, profile);
  const owner = room.members.find((member) => member.role === 'owner');
  const isOwner = myMember?.role === 'owner';
  const isManager = myMember?.role === 'manager';

  const items = [
    ...(isOwner || isManager ? [{ label: '새 일정 추가', icon: CalendarPlus, onClick: onScheduleAdd }] : []),
    { label: '참여자 목록', icon: UsersRound, onClick: onParticipants },
    ...(isOwner ? [{ label: '참여자 및 권한 관리', icon: Shield, onClick: onParticipants }] : []),
    ...(isOwner ? [{ label: '방 일정 관리', icon: CalendarPlus, onClick: onManagement }] : []),
    ...(isOwner ? [{ label: '방장 위임', icon: Crown, onClick: onTransfer }] : []),
    ...(isOwner ? [{ label: '방 설정', icon: Settings, onClick: onInfo }] : []),
    ...(isOwner || isManager ? [{ label: '초대 링크 관리', icon: KeyRound, onClick: onInvite }] : []),
    ...(isOwner ? [{ label: '방 삭제', icon: Trash2, onClick: onDelete, danger: true }] : []),
    ...(!isOwner ? [{ label: '방 정보', icon: Settings, onClick: onInfo }] : []),
    ...(!isOwner ? [{ label: '내 권한 보기', icon: Shield, onClick: onInfo }] : []),
  ];

  return (
    <Sheet open={open} title={`방 기능 - ${myMember ? roomRoleLabels[myMember.role] : '참여자'}`} onClose={onClose}>
      <Card className="mb-4">
        <p className="font-black text-gray-950">{room.name}</p>
        <p className="mt-1 text-sm text-gray-500">내 닉네임: {myMember?.nickname}</p>
        <p className="mt-1 text-sm text-gray-500">방장: {owner?.nickname}</p>
      </Card>
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-app-border bg-white px-4 text-left font-bold text-gray-900"
              onClick={item.onClick}
            >
              <span className={cn('flex items-center gap-3', item.danger && 'text-app-danger')}>
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              <span className="text-gray-300">›</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function ScheduleFormSheet({
  open,
  room,
  schedule,
  currentUser,
  task,
  onClose,
  onSubmit,
}: {
  open: boolean;
  room: SchedulingRoom;
  schedule: Schedule | null;
  currentUser: Profile;
  task: PreliminaryTask | null;
  onClose: () => void;
  onSubmit: (values: ScheduleFormValues) => Promise<void> | void;
}) {
  const formId = `schedule-form-${room.id}`;
  const formRef = useRef<HTMLFormElement>(null);
  const [captureText, setCaptureText] = useState('');
  const [captureStatus, setCaptureStatus] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentMember = getMyMember(room, currentUser) ?? room.members[0];
  const defaultDate = schedule ? format(new Date(schedule.startAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const defaultStartTime = schedule ? format(new Date(schedule.startAt), 'HH:mm') : '14:30';
  const defaultEndTime = schedule ? format(new Date(schedule.endAt), 'HH:mm') : '16:30';

  const setInputValue = (name: keyof ScheduleFormValues, value?: string) => {
    if (!value || !formRef.current) {
      return;
    }

    const input = formRef.current.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) {
      input.value = value;
    }
  };

  const applyParsedScheduleText = (text: string) => {
    const parsed = parseScheduleText(text);

    setInputValue('date', parsed.date);
    setInputValue('startTime', parsed.startTime);
    setInputValue('endTime', parsed.endTime);
    setInputValue('address', parsed.address);
    setInputValue('customerPhone', parsed.customerPhone);
    setInputValue('estimatedPrice', parsed.estimatedPrice);
    setInputValue('additionalInfo', parsed.additionalInfo);

    const appliedFields = ['date', 'startTime', 'endTime', 'address', 'customerPhone', 'estimatedPrice'] as const;
    const appliedCount = appliedFields.filter((key) => Boolean(parsed[key])).length;

    setCaptureStatus(
      appliedCount > 0
        ? `${appliedCount}개 항목을 자동 입력했습니다.`
        : '자동으로 찾은 항목이 없습니다. 문자 내용을 조금 더 길게 붙여넣어 주세요.',
    );
  };

  const handleImageCapture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    event.target.value = '';
    setIsOcrProcessing(true);
    setCaptureStatus('이미지에서 글자를 읽는 중입니다. 0%');

    try {
      const result = await recognizeImageText(file, (progress) => {
        setCaptureStatus(`이미지에서 글자를 읽는 중입니다. ${progress}%`);
      });

      if (result.kind === 'success') {
        setCaptureText(result.text);
        applyParsedScheduleText(result.text);
      } else if (result.kind === 'empty') {
        setCaptureStatus('이미지에서 읽을 수 있는 글자를 찾지 못했습니다. 문자 내용을 직접 붙여넣어 주세요.');
      } else if (result.kind === 'unavailable') {
        setCaptureStatus('이 브라우저에서는 이미지 글자 인식을 시작할 수 없습니다. 문자 내용을 직접 붙여넣어 자동 입력할 수 있습니다.');
      } else {
        setCaptureStatus(result.message);
      }
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const values: ScheduleFormValues = {
      title: String(formData.get('title') ?? ''),
      participantMemberIds: formData.getAll('participantMemberIds').map(String),
      date: String(formData.get('date') ?? ''),
      startTime: String(formData.get('startTime') ?? ''),
      endTime: String(formData.get('endTime') ?? ''),
      address: String(formData.get('address') ?? ''),
      customerPhone: String(formData.get('customerPhone') ?? ''),
      estimatedPrice: String(formData.get('estimatedPrice') ?? ''),
      additionalInfo: String(formData.get('additionalInfo') ?? ''),
    };

    const startAt = new Date(`${values.date}T${values.startTime}:00+09:00`);
    const endAt = new Date(`${values.date}T${values.endTime}:00+09:00`);
    const endTimeInput = event.currentTarget.elements.namedItem('endTime') as HTMLInputElement | null;

    if (endAt <= startAt) {
      endTimeInput?.setCustomValidity('종료 시간은 시작 시간보다 늦어야 합니다.');
      event.currentTarget.reportValidity();
      return;
    }

    endTimeInput?.setCustomValidity('');

    try {
      setIsSubmitting(true);
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      title={schedule ? '일정 수정' : '일정 추가'}
      description="참여자 1명은 개인 일정, 2명 이상은 공동 일정으로 등록됩니다."
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>취소</Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>{isSubmitting ? '저장 중' : schedule ? '수정 저장' : '일정 저장'}</Button>
        </div>
      }
    >
      <form ref={formRef} id={formId} className="space-y-4" onSubmit={handleSubmit}>
        {!schedule ? (
          <div className="rounded-2xl border border-app-border bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-400">문자 자동 입력</p>
                <p className="mt-1 text-sm font-semibold text-gray-800">캡쳐 이미지 또는 문자 내용을 넣으면 주요 항목을 채웁니다.</p>
              </div>
              <label className={cn(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-gray-50',
                isOcrProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              )}>
                <ImagePlus className="h-4 w-4" />
                {isOcrProcessing ? '인식 중' : '캡쳐'}
                <input type="file" accept="image/*" className="sr-only" disabled={isOcrProcessing} onChange={handleImageCapture} />
              </label>
            </div>
            <textarea
              value={captureText}
              onChange={(event) => setCaptureText(event.target.value)}
              placeholder="문자 내용을 붙여넣기"
              className="mt-3 min-h-24 w-full rounded-xl border border-app-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-app-blue focus:ring-4 focus:ring-blue-100"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-gray-500">{captureStatus}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => applyParsedScheduleText(captureText)}>
                자동 입력
              </Button>
            </div>
          </div>
        ) : null}
        <Field label="일정 이름" name="title" defaultValue={schedule?.title ?? task?.title ?? ''} placeholder="에어컨 청소" required />
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700">참여자</p>
          <div className="flex flex-wrap gap-2">
            {room.members.map((member, index) => (
              <label key={member.id} className="flex min-h-11 items-center gap-2 rounded-full border border-app-border px-3 text-sm font-bold">
                <input
                  type="checkbox"
                  name="participantMemberIds"
                  value={member.id}
                  defaultChecked={schedule ? schedule.participantMemberIds.includes(member.id) : member.id === currentMember?.id || index === 0}
                />
                {member.nickname}
              </label>
            ))}
          </div>
        </div>
        <Field label="날짜" name="date" type="date" defaultValue={defaultDate} required />
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작 시간" name="startTime" type="time" step={1800} defaultValue={defaultStartTime} required />
          <Field label="종료 시간" name="endTime" type="time" step={1800} defaultValue={defaultEndTime} required />
        </div>
        <Field label="주소" name="address" defaultValue={schedule?.address ?? ''} placeholder="천안시" />
        <Field label="고객 전화번호" name="customerPhone" defaultValue={schedule?.customerPhone ?? ''} placeholder="010-1234-5678" />
        <Field label="예상 비용" name="estimatedPrice" type="number" defaultValue={schedule?.estimatedPrice?.toString() ?? ''} placeholder="180000" />
        <TextareaField label="추가 정보" name="additionalInfo" defaultValue={schedule?.additionalInfo ?? task?.memo ?? ''} placeholder="추가 정보를 입력하세요" />
      </form>
    </Sheet>
  );
}

function ScheduleDetailSheet({
  open,
  schedule,
  room,
  profile,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  schedule: Schedule | null;
  room: SchedulingRoom;
  profile: Profile;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!schedule) {
    return null;
  }

  const participants = getScheduleParticipants(room, schedule);
  const myMember = getMyMember(room, profile);
  const canManage = roleCanManageSchedules(myMember);
  const creator = room.members.find((member) => member.id === schedule.createdByMemberId);
  const phoneNumber = sanitizePhoneNumber(schedule.customerPhone);
  const navigationUrls = schedule.address ? buildNavigationUrls(schedule.address) : null;
  const googleCalendarUrl = buildGoogleCalendarUrl(schedule);

  return (
    <Sheet open={open} title="일정 상세" onClose={onClose}>
      <div className="space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <StatusBadge status={schedule.status} />
              <h2 className="mt-3 text-xl font-black text-gray-950">{schedule.title}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {format(new Date(schedule.startAt), 'M월 d일 HH:mm')} - {format(new Date(schedule.endAt), 'HH:mm')}
              </p>
            </div>
            <ParticipantAvatarGroup members={participants} />
          </div>
        </Card>
        <상세
          label="일정 시간"
          value={`${format(new Date(schedule.startAt), 'yyyy년 M월 d일 HH:mm')} - ${format(new Date(schedule.endAt), 'HH:mm')}`}
        />
        <상세 label="참여자" value={participants.map((member) => member.nickname).join(', ')} />
        <상세
          label="주소"
          value={schedule.address ?? '-'}
          action={navigationUrls ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <a className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-app-border bg-white px-2 text-xs font-bold text-gray-900" href={navigationUrls.kakao} target="_blank" rel="noreferrer">
                <MapPinned className="h-3.5 w-3.5" />
                카카오
              </a>
              <a className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-app-border bg-white px-2 text-xs font-bold text-gray-900" href={navigationUrls.naver} target="_blank" rel="noreferrer">
                <Navigation className="h-3.5 w-3.5" />
                네이버
              </a>
              <a className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-app-border bg-white px-2 text-xs font-bold text-gray-900" href={navigationUrls.google} target="_blank" rel="noreferrer">
                <MapPinned className="h-3.5 w-3.5" />
                구글
              </a>
            </div>
          ) : null}
        />
        <상세
          label="고객 전화번호"
          value={formatPhoneForDisplay(schedule.customerPhone)}
          action={phoneNumber ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-3 text-sm font-bold text-gray-900" href={`sms:${phoneNumber}`}>
                <MessageCircle className="h-4 w-4" />
                문자
              </a>
              <a className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-3 text-sm font-bold text-gray-900" href={`tel:${phoneNumber}`}>
                <Phone className="h-4 w-4" />
                전화
              </a>
            </div>
          ) : null}
        />
        <상세 label="예상 비용" value={formatCurrency(schedule.estimatedPrice)} />
        <상세 label="추가 정보" value={schedule.additionalInfo ?? '-'} />
        <상세 label="등록자" value={creator?.nickname ?? '-'} />
        <상세 label="마지막 수정" value={format(new Date(schedule.updatedAt), 'yyyy-MM-dd HH:mm')} />
        <a
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          href={googleCalendarUrl}
          target="_blank"
          rel="noreferrer"
        >
          <CalendarPlus className="h-4 w-4" />
          구글 캘린더에 추가
        </a>
        {canManage ? (
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={onEdit}>수정</Button>
            <Button type="button" variant="danger" onClick={onDelete}>삭제</Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>닫기</Button>
        )}
      </div>
    </Sheet>
  );
}

function 상세({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
      {action}
    </div>
  );
}

function ParticipantManagementSheet({
  open,
  room,
  onClose,
  onTransfer,
  onRoleChange,
  onKick,
}: {
  open: boolean;
  room: SchedulingRoom;
  onClose: () => void;
  onTransfer: () => void;
  onRoleChange: (memberId: string, role: RoomMember['role']) => void;
  onKick: (memberId: string) => void;
}) {
  return (
    <Sheet open={open} title="참여자 및 권한 관리" onClose={onClose}>
      <div className="space-y-3">
        {room.members.map((member) => (
          <Card key={member.id}>
            <div className="flex items-start gap-3">
              <ParticipantAvatar member={member} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-gray-950">{member.nickname}</p>
                  <RoleBadge role={member.role} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{member.email}</p>
                <p className="mt-1 text-xs text-gray-400">참여일 {format(new Date(member.joinedAt), 'yyyy-MM-dd')}</p>
              </div>
            </div>
            {member.role !== 'owner' ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRoleChange(member.id, member.role === 'manager' ? 'member' : 'manager')}
                >
                  {member.role === 'manager' ? '해제' : '부여'} 매니저
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onTransfer}>위임</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onKick(member.id)}>내보내기</Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

function TransferOwnershipSheet({
  open,
  room,
  checked,
  onCheckedChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  room: SchedulingRoom;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  onConfirm: (memberId: string) => void;
  onClose: () => void;
}) {
  const current방장 = room.members.find((member) => member.role === 'owner');
  const candidates = room.members.filter((member) => member.role !== 'owner');
  const [targetMemberId, setTargetMemberId] = useState(candidates[0]?.id ?? '');
  const target = room.members.find((member) => member.id === targetMemberId);

  return (
    <Sheet
      open={open}
      title="방장 위임"
      description="위임 후 현재 방장은 매니저로 변경됩니다."
      onClose={onClose}
      footer={
        <Button type="button" className="w-full" disabled={!checked || !targetMemberId} onClick={() => onConfirm(targetMemberId)}>
          방장 위임
        </Button>
      }
    >
      <div className="space-y-4">
        <상세 label="현재 방장" value={current방장?.nickname ?? '-'} />
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-gray-700">새 방장</span>
          <select
            value={targetMemberId}
            onChange={(event) => setTargetMemberId(event.target.value)}
            className="h-11 w-full rounded-xl border border-app-border bg-white px-3 text-sm outline-none focus:border-app-blue focus:ring-4 focus:ring-blue-100"
          >
            {candidates.length > 0 ? (
              candidates.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname} · {roomRoleLabels[member.role]}
                </option>
              ))
            ) : (
              <option value="">위임할 참여자가 없습니다</option>
            )}
          </select>
        </label>
        <상세 label="새 방장 미리보기" value={target?.nickname ?? '참여자를 선택하세요'} />
        <상세 label="위임 후 권한" value="현재 방장: 매니저 · 새 방장: 방장" />
        <label className="flex items-start gap-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
          방장 권한이 이전되는 것을 확인했습니다.
        </label>
      </div>
    </Sheet>
  );
}

function RoomScheduleManagementSheet({
  open,
  room,
  schedules,
  onClose,
  onOpenSchedule,
  onEditSchedule,
  onDeleteSchedule,
  onStatusChange,
}: {
  open: boolean;
  room: SchedulingRoom;
  schedules: Schedule[];
  onClose: () => void;
  onOpenSchedule: (schedule: Schedule) => void;
  onEditSchedule: (schedule: Schedule) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onStatusChange: (scheduleId: string, status: Schedule['status']) => void;
}) {
  const completed = schedules.filter((schedule) => schedule.status === 'completed').length;

  return (
    <Sheet open={open} title="방 일정 관리" description="현재 방의 일정만 표시됩니다." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="전체" value={schedules.length} />
          <Stat label="완료" value={completed} />
        </div>
        <Field label="검색" placeholder="일정 검색" />
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-gray-950">{schedule.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{format(new Date(schedule.startAt), 'yyyy-MM-dd HH:mm')}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {getScheduleParticipants(room, schedule).map((member) => member.nickname).join(', ')}
                  </p>
                </div>
                <StatusBadge status={schedule.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenSchedule(schedule)}>상세</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onEditSchedule(schedule)}>수정</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(schedule.id, schedule.status === 'completed' ? 'scheduled' : 'completed')}
                >
                  {schedule.status === 'completed' ? '예정으로 변경' : '완료 처리'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onDeleteSchedule(schedule.id)}>삭제</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function PreliminaryTaskSheet({
  open,
  rooms,
  task,
  onClose,
  onSubmit,
}: {
  open: boolean;
  rooms: SchedulingRoom[];
  task: PreliminaryTask | null;
  onClose: () => void;
  onSubmit: (values: PreliminaryTaskFormValues) => Promise<void>;
}) {
  const formId = 'preliminary-task-form';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const priority = String(formData.get('priority') ?? 'normal');

    await onSubmit({
      title: String(formData.get('title') ?? ''),
      memo: String(formData.get('memo') ?? ''),
      priority: priority === 'high' || priority === 'low' ? priority : 'normal',
      roomId: String(formData.get('roomId') ?? 'none'),
      dueDate: String(formData.get('dueDate') ?? ''),
    });
  };

  return (
    <Sheet
      open={open}
      title={task ? '예비 할 일 수정' : '예비 할 일 추가'}
      description="일정으로 확정하기 전의 개인 할 일을 등록하세요."
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" form={formId}>{task ? '수정 저장' : '저장'}</Button>
        </div>
      }
    >
      <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
        <Field label="할 일 제목" name="title" defaultValue={task?.title ?? ''} placeholder="고객 견적 준비" required />
        <TextareaField label="메모" name="memo" defaultValue={task?.memo ?? ''} placeholder="메모를 입력하세요" />
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-gray-700">관련 방</span>
          <select
            name="roomId"
            defaultValue={task?.roomId ?? 'none'}
            className="h-11 w-full rounded-xl border border-app-border bg-white px-3 text-sm outline-none focus:border-app-blue focus:ring-4 focus:ring-blue-100"
          >
            <option value="none">연결된 방 없음</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700">중요도</p>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'normal', 'high'] as const).map((priority) => (
              <label key={priority} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-white text-sm font-bold text-gray-700">
                <input type="radio" name="priority" value={priority} defaultChecked={(task?.priority ?? 'normal') === priority} />
                {priority === 'low' ? '낮음' : priority === 'normal' ? '보통' : '높음'}
              </label>
            ))}
          </div>
        </div>
        <Field label="예정일" name="dueDate" type="date" defaultValue={task?.dueDate ?? ''} />
      </form>
    </Sheet>
  );
}

function RoomInfoSheet({ open, room, onClose }: { open: boolean; room: SchedulingRoom; onClose: () => void }) {
  return (
    <Sheet open={open} title="방 정보" onClose={onClose}>
      <div className="space-y-4">
        <상세 label="방" value={room.name} />
        <상세 label="설명" value={room.description ?? '-'} />
        <상세 label="업무 시간" value={`${room.businessStartTime} - ${room.businessEndTime}`} />
        <상세 label="참여자" value={`${room.members.length}`} />
      </div>
    </Sheet>
  );
}
