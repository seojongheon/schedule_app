import { CalendarX, Loader2, WifiOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-8 text-center">
      <CalendarX className="h-8 w-8 text-app-blue" />
      <h3 className="mt-3 text-sm font-bold text-gray-950">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </Card>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-8 text-center">
      <WifiOff className="h-8 w-8 text-app-danger" />
      <h3 className="mt-3 text-sm font-bold text-gray-950">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </Card>
  );
}

export function LoadingState({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 text-sm font-semibold text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-app bg-gray-100', className)} />;
}
