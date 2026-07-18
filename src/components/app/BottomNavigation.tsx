'use client';

import { LayoutDashboard, LogOut, MessageCircleQuestion, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

function isDashboardActive(pathname: string) {
  return pathname === '/dashboard' || pathname === '/rooms' || pathname.startsWith('/rooms/');
}

export function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Supabase 설정이 없는 데모 모드에서도 로그인 화면으로 이동합니다.
    }

    setConfirmOpen(false);
    router.push('/login');
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-app-border bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur md:bottom-5 md:rounded-[28px] md:border md:shadow-soft">
        <div className="grid grid-cols-4 gap-1">
          <Link
            href="/dashboard"
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-app-blue',
              isDashboardActive(pathname) && 'bg-app-blueSoft text-app-blue',
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            대시보드
          </Link>
          <Link
            href="/support"
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-app-blue',
              pathname.startsWith('/support') && 'bg-app-blueSoft text-app-blue',
            )}
          >
            <MessageCircleQuestion className="h-5 w-5" />
            문의
          </Link>
          <Link
            href="/mypage"
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-app-blue',
              (pathname === '/mypage' || pathname === '/admin') && 'bg-app-blueSoft text-app-blue',
            )}
          >
            <UserRound className="h-5 w-5" />
            마이페이지
          </Link>
          <button
            type="button"
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-app-blue"
            onClick={() => setConfirmOpen(true)}
          >
            <LogOut className="h-5 w-5" />
            로그아웃
          </button>
        </div>
      </nav>
      <ConfirmDialog
        open={confirmOpen}
        title="로그아웃할까요?"
        description="현재 로그인 세션이 종료됩니다."
        confirmLabel="로그아웃"
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
      />
    </>
  );
}
