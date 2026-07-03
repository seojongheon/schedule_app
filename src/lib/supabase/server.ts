import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/data/database.types';

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_PUBLIC_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 공개 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인해주세요.');
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Route Handlers and Server Actions can.
        }
      },
    },
  });
}
