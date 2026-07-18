import type { ServiceRole } from '@/domain/authorization/capabilities';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type InquiryActor = {
  userId: string;
  accountState: string;
  serviceRoles: ServiceRole[];
};

export async function requireInquiryActor(): Promise<InquiryActor> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Authentication required.');

  const [{ data: profile, error: profileError }, { data: assignments, error: rolesError }] = await Promise.all([
    supabase.from('profiles').select('account_state').eq('id', user.id).single(),
    supabase.from('service_role_assignments').select('role').eq('user_id', user.id).is('revoked_at', null),
  ]);
  const accountProfile = profile as unknown as { account_state: string } | null;
  const activeAssignments = assignments as unknown as Array<{ role: ServiceRole }> | null;
  if (profileError || !accountProfile || rolesError) throw new Error('Inquiry access unavailable.');
  return { userId: user.id, accountState: accountProfile.account_state, serviceRoles: (activeAssignments ?? []).map(({ role }) => role) };
}
