import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/data/database.types';

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase 관리자 환경 변수가 설정되지 않았습니다. SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_SECRET_KEY를 확인해주세요.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
