import { cn } from '@/lib/utils';

export function ParticipantFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition',
        active ? 'border-app-blue bg-app-blue text-white' : 'border-app-border bg-white text-gray-600',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
