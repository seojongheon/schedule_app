import type { ReactNode } from 'react';
import { BottomNavigation } from '@/components/app/BottomNavigation';

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app-background">
      <main className="safe-bottom mx-auto w-full max-w-[430px] px-4 py-5 md:max-w-3xl">{children}</main>
      <BottomNavigation />
    </div>
  );
}
