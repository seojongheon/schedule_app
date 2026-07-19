import type { Metadata } from 'next';
import { ScheduleWorkspace } from '@/components/app/ScheduleWorkspace';
import { getScheduleWorkspaceData } from '@/data/schedule-supabase';
import { getCurrentProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: '오늘 할 일',
};

export const dynamic = 'force-dynamic';

export default async function TodayTasksPage() {
  const profile = await getCurrentProfile();
  const initialData = await getScheduleWorkspaceData(profile, { page: 'todayTasks' });
  return <ScheduleWorkspace page="todayTasks" profile={profile} initialData={initialData} />;
}
