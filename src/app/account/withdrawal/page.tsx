import { redirect } from 'next/navigation';
import { WithdrawalPanel } from '@/components/account/WithdrawalPanel';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function WithdrawalPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.from('profiles').select('account_state, deletion_due_at').eq('id', user.id).single();
  const profile = data as unknown as { account_state: string; deletion_due_at: string | null } | null;
  if (profile?.account_state !== 'deletion_pending' || !profile.deletion_due_at) redirect('/dashboard');
  return <WithdrawalPanel deletionDueAt={profile.deletion_due_at} />;
}
