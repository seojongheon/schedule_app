import type { Metadata } from 'next';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { getAdminActor } from '@/lib/admin/route-access';

export const metadata: Metadata = { title: '운영 관리' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const actor = await getAdminActor();
  return <AdminWorkspace roles={actor?.roles ?? []} />;
}
