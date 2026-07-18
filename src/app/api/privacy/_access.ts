import { assertPrivacyReauthentication } from '@/domain/privacy/privacy-request';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type PrivacyActor = {
  userId: string;
  email: string | null;
  displayName: string;
  accountState: string;
  deletionDueAt: string | null;
};

export async function requirePrivacyActor(): Promise<PrivacyActor> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Authentication is required.');
  const { data, error } = await supabase.from('profiles')
    .select('display_name, account_state, deletion_due_at, last_reauthenticated_at')
    .eq('id', user.id)
    .single();
  const profile = data as unknown as {
    display_name: string;
    account_state: string;
    deletion_due_at: string | null;
    last_reauthenticated_at: string | null;
  } | null;
  if (error || !profile) throw new Error('Privacy profile is unavailable.');
  assertPrivacyReauthentication({ userId: user.id, lastReauthenticatedAt: profile.last_reauthenticated_at });
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: profile.display_name,
    accountState: profile.account_state,
    deletionDueAt: profile.deletion_due_at,
  };
}
