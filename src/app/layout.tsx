import type { Metadata, Viewport } from 'next';
import './globals.css';

const siteUrl = process.env.NODE_ENV === 'production'
  ? 'https://schedule-app-mmyh.vercel.app'
  : (process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
const ogImageUrl = new URL('/og-kakao.jpg', siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | 공유 스케줄',
    default: '공유 스케줄',
  },
  description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: '공유 스케줄',
    description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
    url: '/',
    siteName: '공유 스케줄',
    locale: 'ko_KR',
    type: 'website',
    images: [
      {
        url: ogImageUrl,
        secureUrl: ogImageUrl,
        width: 1200,
        height: 1200,
        type: 'image/jpeg',
        alt: '공유 스케줄 서비스 미리보기',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '공유 스케줄',
    description: '여러 스케줄링 방의 일정을 함께 관리하는 공유 일정 서비스입니다.',
    images: [ogImageUrl],
  },
  other: {
    'og:image:secure_url': ogImageUrl,
    'og:image:type': 'image/jpeg',
    'og:image:width': '1200',
    'og:image:height': '1200',
    'og:locale:alternate': 'ko_KR',
    'twitter:image:alt': '공유 스케줄 서비스 미리보기',
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
