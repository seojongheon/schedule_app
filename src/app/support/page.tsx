import type { Metadata } from 'next';
import { InquiryWorkspace } from '@/components/support/InquiryWorkspace';

export const metadata: Metadata = { title: '문의' };
export const dynamic = 'force-dynamic';

export default function SupportPage() {
  return <InquiryWorkspace />;
}
