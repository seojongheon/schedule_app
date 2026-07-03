'use client';

import { CheckCircle2, Circle, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { Schedule, SchedulingRoom } from '@/domain/entities';
import { Card } from '@/components/ui/card';

export function TodayTaskCard({
  schedule,
  room,
  onOpen,
  onToggleChecked,
}: {
  schedule: Schedule;
  room: SchedulingRoom;
  onOpen: () => void;
  onToggleChecked: (checked: boolean) => void;
}) {
  const members = room.members.filter((member) => schedule.participantMemberIds.includes(member.id));

  return (
    <Card className="cursor-pointer" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 text-app-blue"
          aria-label="개인 완료 상태 변경"
          onClick={(event) => {
            event.stopPropagation();
            onToggleChecked(!schedule.isChecked);
          }}
        >
          {schedule.isChecked ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: room.color }} />
            <p className="truncate text-sm font-bold text-gray-950">{schedule.title}</p>
          </div>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {format(new Date(schedule.startAt), 'HH:mm')} - {format(new Date(schedule.endAt), 'HH:mm')} · {room.name}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
              <Users className="h-3.5 w-3.5" />
              {members.map((member) => member.nickname).join(', ')}
            </span>
            {schedule.address ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
                <MapPin className="h-3.5 w-3.5" />
                {schedule.address}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
