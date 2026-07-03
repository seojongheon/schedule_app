import { ArrowRight, CalendarDays, UsersRound } from 'lucide-react';
import Link from 'next/link';
import type { Profile, SchedulingRoom } from '@/domain/entities';
import { Card } from '@/components/ui/card';
import { RoleBadge } from '@/components/common/RoleBadge';
import { ParticipantAvatarGroup } from '@/components/common/ParticipantAvatar';

export function RoomCard({ room, currentUser }: { room: SchedulingRoom; currentUser: Profile }) {
  const myMember = room.members.find((member) => member.userId === currentUser.id) ?? room.members[0];

  return (
    <Link href={`/rooms/${room.id}`} className="block">
      <Card className="transition hover:-translate-y-0.5 hover:border-blue-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: room.color }}
            >
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-950">{room.name}</h3>
                <RoleBadge role={myMember.role} />
              </div>
              <p className="mt-1 text-xs text-gray-500">{room.description}</p>
              <p className="mt-3 text-xs font-medium text-gray-500">내 닉네임: {myMember.nickname}</p>
            </div>
          </div>
          <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-gray-400" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-gray-500">
          <div className="rounded-xl bg-gray-50 p-2">
            <p className="font-bold text-gray-950">{room.members.length}</p>
            <p>참여자</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2">
            <p className="font-bold text-gray-950">{room.todayScheduleCount}</p>
            <p>오늘</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-2">
            <p className="font-bold text-gray-950">다음</p>
            <p className="truncate">{room.nextSchedule ?? '-'}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <UsersRound className="h-4 w-4" />
            {room.recentActivity}
          </div>
          <ParticipantAvatarGroup members={room.members} />
        </div>
      </Card>
    </Link>
  );
}
