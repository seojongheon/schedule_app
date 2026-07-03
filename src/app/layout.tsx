import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | 공유 스케줄',
    default: '공유 스케줄',
  },
  description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f7ff',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
