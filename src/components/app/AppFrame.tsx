import type { ReactNode } from 'react';
import { BottomNavigation } from '@/components/app/BottomNavigation';

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-app-background">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold text-app-blue focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        본문으로 건너뛰기
      </a>
      <main id="main-content" tabIndex={-1} className="safe-bottom mx-auto w-full max-w-[430px] px-4 py-5 outline-none md:max-w-3xl">{children}</main>
      <BottomNavigation />
    </div>
  );
}
