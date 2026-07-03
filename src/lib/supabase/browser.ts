import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/data/database.types';

let browserClient: ReturnType<typeof createBrowserClient<Database, 'public', Database['public']>> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 공개 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인해주세요.');
  }

  browserClient = createBrowserClient<Database, 'public', Database['public']>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
