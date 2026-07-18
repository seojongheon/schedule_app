import { NextResponse } from 'next/server';
import { hasRecentAuthentication } from '@/domain/auth/account-policy';
import { createProviderRegistry, requireExplicitIdentityLink, type SocialProvider } from '@/lib/auth/provider-registry';
import { loadSecurityConfig } from '@/lib/security-config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withSensitiveRateLimit } from '@/lib/rate-limit/with-rate-limit';

async function getHandler(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!['google', 'kakao', 'naver'].includes(provider)) return NextResponse.redirect(new URL('/login?provider=invalid', request.url));
  const mode = new URL(request.url).searchParams.get('mode') === 'link' ? 'link' : 'signin';
  const config = loadSecurityConfig();
  const registry = createProviderRegistry(config.providers);
  const definition = registry[provider as SocialProvider];
  if (!definition.enabled) return NextResponse.redirect(new URL('/login?provider=disabled', request.url));

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  let recentlyAuthenticated = false;
  if (user) {
    const { data } = await supabase.from('profiles').select('last_reauthenticated_at').eq('id', user.id).single();
    const profile = data as { last_reauthenticated_at: string | null } | null;
    recentlyAuthenticated = hasRecentAuthentication(profile?.last_reauthenticated_at);
  }
  const linkDecision = requireExplicitIdentityLink({ mode, authenticatedUserId: user?.id ?? null, recentlyAuthenticated });
  if (!linkDecision.allowed) return NextResponse.redirect(new URL(`/login?provider=${linkDecision.reason}`, request.url));

  const callbackUrl = new URL('/auth/callback', request.url);
  callbackUrl.searchParams.set('mode', mode);
  callbackUrl.searchParams.set('provider', provider);
  const credentials = { provider: definition.supabaseProvider as never, options: { redirectTo: callbackUrl.toString(), skipBrowserRedirect: true } };
  const result = mode === 'link'
    ? await supabase.auth.linkIdentity(credentials)
    : await supabase.auth.signInWithOAuth(credentials);
  if (result.error || !result.data.url) return NextResponse.redirect(new URL('/login?provider=unavailable', request.url));
  const response = NextResponse.redirect(result.data.url);
  response.cookies.set('auth_flow_mode', `${mode}:${provider}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}

export const GET = withSensitiveRateLimit(getHandler);
