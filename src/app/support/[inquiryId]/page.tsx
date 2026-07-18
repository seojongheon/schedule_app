import type { Metadata } from 'next';
import { InquiryWorkspace } from '@/components/support/InquiryWorkspace';

export const metadata: Metadata = { title: '문의 상세' };
export const dynamic = 'force-dynamic';

export default async function InquiryDetailPage({ params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;
  return <InquiryWorkspace inquiryId={inquiryId} />;
}
