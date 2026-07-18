export type SocialProvider = 'google' | 'kakao' | 'naver';

type ProviderInput = { enabled: boolean; provider: string };
export type ProviderDefinition = {
  id: SocialProvider;
  enabled: boolean;
  supabaseProvider: string;
  emailOptional: true;
  disabledReason?: 'disabled_by_configuration' | 'invalid_custom_provider';
};

export function createProviderRegistry(input: Record<SocialProvider, ProviderInput>): Record<SocialProvider, ProviderDefinition> {
  return Object.fromEntries((['google', 'kakao', 'naver'] as const).map((id) => {
    const configured = input[id];
    const validCustomProvider = /^custom:[a-z0-9][a-z0-9_-]{1,62}$/.test(configured.provider);
    const enabled = configured.enabled && validCustomProvider;
    return [id, {
      id,
      enabled,
      supabaseProvider: configured.provider,
      emailOptional: true as const,
      ...(!enabled ? {
        disabledReason: configured.enabled ? 'invalid_custom_provider' as const : 'disabled_by_configuration' as const,
      } : {}),
    }];
  })) as Record<SocialProvider, ProviderDefinition>;
}

export function requireExplicitIdentityLink(input: {
  mode: 'signin' | 'link';
  authenticatedUserId: string | null;
  recentlyAuthenticated: boolean;
}):
  | { allowed: true; mode: 'signin' }
  | { allowed: true; mode: 'link'; userId: string }
  | { allowed: false; reason: 'authentication_required' | 'recent_authentication_required' } {
  if (input.mode === 'signin') return { allowed: true, mode: 'signin' };
  if (!input.authenticatedUserId) return { allowed: false, reason: 'authentication_required' };
  if (!input.recentlyAuthenticated) return { allowed: false, reason: 'recent_authentication_required' };
  return { allowed: true, mode: 'link', userId: input.authenticatedUserId };
}
