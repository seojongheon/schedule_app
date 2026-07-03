'use client';

import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import type { PreliminaryTask, SchedulingRoom } from '@/domain/entities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { taskPriorityLabels } from '@/lib/korean-labels';
import { cn } from '@/lib/utils';

export function PreliminaryTaskCard({
  task,
  room,
  onConvert,
  onEdit,
  onDelete,
  onToggleCompleted,
}: {
  task: PreliminaryTask;
  room?: SchedulingRoom;
  onConvert: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleCompleted: (checked: boolean) => void;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 rounded border-app-border text-app-blue"
          checked={task.isCompleted}
          onChange={(event) => onToggleCompleted(event.target.checked)}
          aria-label={`${task.title} 완료 상태 변경`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-gray-950">{task.title}</p>
              {task.memo ? <p className="mt-1 text-xs text-gray-500">{task.memo}</p> : null}
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-[11px] font-bold',
                task.priority === 'high' && 'bg-red-50 text-app-danger',
                task.priority === 'normal' && 'bg-blue-50 text-app-blue',
                task.priority === 'low' && 'bg-gray-100 text-gray-500',
              )}
            >
              {taskPriorityLabels[task.priority]}
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {room?.name ?? '연결된 방 없음'} · {task.dueDate ?? '예정일 없음'}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onConvert}>
              <CalendarPlus className="h-4 w-4" />
              일정 등록
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              수정
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-app-danger" />
              삭제
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
