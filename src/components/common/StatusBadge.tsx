import type { ScheduleStatus } from '@/domain/entities';
import { scheduleStatusLabels } from '@/lib/korean-labels';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: ScheduleStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold',
        status === 'scheduled' && 'bg-blue-50 text-app-blue',
        status === 'completed' && 'bg-emerald-50 text-emerald-700',
        status === 'cancelled' && 'bg-red-50 text-app-danger',
      )}
    >
      {scheduleStatusLabels[status]}
    </span>
  );
}
