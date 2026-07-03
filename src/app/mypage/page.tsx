import type { Metadata } from 'next';
import { ScheduleWorkspace } from '@/components/app/ScheduleWorkspace';
import { getScheduleWorkspaceData } from '@/data/schedule-supabase';
import { getCurrentProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: '마이페이지',
};

export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const profile = await getCurrentProfile();
  const initialData = await getScheduleWorkspaceData(profile);
  return <ScheduleWorkspace page="mypage" profile={profile} initialData={initialData} />;
}
