import { Bell, CalendarDays } from 'lucide-react';
import type { Profile } from '@/domain/entities';
import { Button } from '@/components/ui/button';

export function AppHeader({ profile, subtitle }: { profile: Profile; subtitle: string }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-app-blue text-white">
            <CalendarDays className="h-5 w-5" />
          </span>
          <p className="text-sm font-bold text-app-blue">공유 스케줄</p>
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-950">안녕하세요, {profile.name}님</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      <Button type="button" variant="outline" size="icon" aria-label="알림">
        <Bell className="h-4 w-4" />
      </Button>
    </header>
  );
}
