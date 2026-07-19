import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/data/database.types';
import { evaluateAccountAccess } from '@/lib/auth/account-access';
import { getVerifiedIdentity } from '@/lib/auth/verified-identity';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const identity = await getVerifiedIdentity(supabase);
  if (!identity) redirect('/login');

  const [{ data, error }, { data: roleData }] = await Promise.all([
    supabase.from('profiles').select('id,display_name,account_state,session_started_at,last_seen_at,last_login_at').eq('id', identity.id).single(),
    supabase.from('service_role_assignments').select('role').eq('user_id', identity.id).is('revoked_at', null),
  ]);
  const profile = data as ProfileRow | null;
  if (error || !profile) redirect('/auth/complete-profile');
  const access = evaluateAccountAccess({
    accountState: profile.account_state,
    area: 'product',
    sessionStartedAt: profile.session_started_at,
    lastSeenAt: profile.last_seen_at,
  });
  if (!access.allowed) redirect(access.reason === 'session_expired' ? '/login?session=expired' : '/auth/complete-profile');

  return {
    id: profile.id,
    email: identity.email,
    name: profile.display_name,
    phone: null,
    isServiceAdmin: (roleData?.length ?? 0) > 0,
    status: 'active' as const,
    lastLoginAt: profile.last_login_at,
  };
}
