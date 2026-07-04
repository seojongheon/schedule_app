import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | 공유 스케줄',
    default: '공유 스케줄',
  },
  description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
  openGraph: {
    title: '공유 스케줄',
    description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
    url: '/',
    siteName: '공유 스케줄',
    locale: 'ko_KR',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 2848,
        height: 1504,
        alt: '공유 스케줄 서비스 미리보기',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '공유 스케줄',
    description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
    images: ['/og.png'],
  },
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
