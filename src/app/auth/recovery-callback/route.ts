import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/recovery?error=invalid', request.url));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL('/recovery?error=invalid', request.url));
  }
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const { error: sessionError } = await createSupabaseAdminClient().rpc('record_verified_authentication', {
    p_actor_user_id: data.user.id,
    p_request_id: requestId,
  });
  if (sessionError) {
    await supabase.auth.signOut({ scope: 'global' });
    return NextResponse.redirect(new URL('/recovery?error=invalid', request.url));
  }
  return NextResponse.redirect(new URL('/recovery?mode=change', request.url));
}
