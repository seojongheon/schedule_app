import type { Metadata } from 'next';
import { ScheduleWorkspace } from '@/components/app/ScheduleWorkspace';
import { getScheduleWorkspaceData } from '@/data/schedule-supabase';
import { getCurrentProfile } from '@/lib/auth';

export const metadata: Metadata = {
  title: '방 달력',
};

export const dynamic = 'force-dynamic';

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const [{ roomId }, profile] = await Promise.all([params, getCurrentProfile()]);
  const initialData = await getScheduleWorkspaceData(profile);
  return <ScheduleWorkspace page="room" roomId={roomId} profile={profile} initialData={initialData} />;
}
