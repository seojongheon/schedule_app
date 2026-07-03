import type { Metadata } from 'next';
import { ScheduleWorkspace } from '@/components/app/ScheduleWorkspace';
import { getScheduleWorkspaceData } from '@/data/schedule-supabase';
import { getCurrentProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: '대시보드',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const initialData = await getScheduleWorkspaceData(profile);
  return <ScheduleWorkspace page="dashboard" profile={profile} initialData={initialData} />;
}
