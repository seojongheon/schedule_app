import type { Metadata } from 'next';
import { ScheduleWorkspace } from '@/components/app/ScheduleWorkspace';
import { getScheduleWorkspaceData } from '@/data/schedule-supabase';
import { getCurrentProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: '예비 할 일',
};

export const dynamic = 'force-dynamic';

export default async function PreliminaryTasksPage() {
  const profile = await getCurrentProfile();
  const initialData = await getScheduleWorkspaceData(profile);
  return <ScheduleWorkspace page="preliminaryTasks" profile={profile} initialData={initialData} />;
}
