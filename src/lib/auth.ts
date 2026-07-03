import { currentUser } from '@/lib/mock-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/data/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentProfile() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return currentUser;
    }

    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    const profile = data as ProfileRow | null;

    if (!profile) {
      return currentUser;
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      isServiceAdmin: profile.is_service_admin,
      status: profile.status,
      lastLoginAt: profile.last_login_at,
    };
  } catch {
    return currentUser;
  }
}
