import type { RoomRole } from '@/domain/entities';
import { roomRoleLabels } from '@/lib/korean-labels';
import { cn } from '@/lib/utils';

export function RoleBadge({ role, className }: { role: RoomRole; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold',
        role === 'owner' && 'bg-violet-100 text-violet-700',
        role === 'manager' && 'bg-blue-100 text-app-blue',
        role === 'member' && 'bg-gray-100 text-gray-600',
        className,
      )}
    >
      {roomRoleLabels[role]}
    </span>
  );
}
