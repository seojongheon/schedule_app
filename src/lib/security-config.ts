export type TrustedProxyMode = 'none' | 'vercel' | 'cloudflare';
export type GuardianVerificationMode = 'disabled' | 'test' | 'provider';

type Environment = Record<string, string | undefined>;

function parseBoolean(env: Environment, name: string): boolean {
  const value = env[name] ?? 'false';
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${name} must be true or false.`);
  }
  return value === 'true';
}

function require256BitKey(value: string | undefined, name: string): string {
  if (!value || Buffer.from(value, 'base64').byteLength !== 32) {
    throw new Error(`${name} must contain a 256-bit base64 key.`);
  }
  return value;
}

function parseProvider(env: Environment, key: 'GOOGLE' | 'KAKAO' | 'NAVER') {
  const enabledName = `AUTH_${key}_ENABLED`;
  const providerName = `AUTH_CUSTOM_${key}_PROVIDER`;
  const enabled = parseBoolean(env, enabledName);
  const provider = env[providerName];
  if (enabled && !provider) throw new Error(`${providerName} is required when ${enabledName}=true.`);
  return { enabled, provider: provider ?? `custom:${key.toLowerCase()}` };
}

export function loadSecurityConfig(env: Environment = process.env) {
  const production = env.NODE_ENV === 'production';
  const activeNumber = env.PRIVATE_DATA_ACTIVE_KEY_VERSION ?? '1';
  if (!/^\d+$/.test(activeNumber) || Number(activeNumber) < 1) {
    throw new Error('PRIVATE_DATA_ACTIVE_KEY_VERSION must be a positive integer.');
  }

  const keys: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    const match = /^PRIVATE_DATA_KEY_V(\d+)$/.exec(name);
    if (match && value) keys[`v${match[1]}`] = require256BitKey(value, name);
  }
  const currentVersion = `v${activeNumber}`;
  if (production && !keys[currentVersion]) {
    throw new Error(`PRIVATE_DATA_KEY_V${activeNumber} is required in production.`);
  }

  const trustedProxyMode = env.TRUSTED_PROXY_MODE ?? 'none';
  if (!['none', 'vercel', 'cloudflare'].includes(trustedProxyMode)) {
    throw new Error('TRUSTED_PROXY_MODE must be none, vercel, or cloudflare.');
  }

  const guardianVerificationMode = env.GUARDIAN_VERIFICATION_MODE ?? 'disabled';
  if (!['disabled', 'test', 'provider'].includes(guardianVerificationMode)) {
    throw new Error('GUARDIAN_VERIFICATION_MODE is invalid.');
  }
  if (production && guardianVerificationMode === 'test') {
    throw new Error('GUARDIAN_VERIFICATION_MODE=test is forbidden in production.');
  }

  return {
    encryption: { currentVersion, keys },
    securityHmacKey: production
      ? require256BitKey(env.SECURITY_HMAC_KEY, 'SECURITY_HMAC_KEY')
      : env.SECURITY_HMAC_KEY,
    deletionHmacKey: production
      ? require256BitKey(env.DELETION_HMAC_KEY, 'DELETION_HMAC_KEY')
      : env.DELETION_HMAC_KEY,
    trustedProxyMode: trustedProxyMode as TrustedProxyMode,
    providers: {
      google: parseProvider(env, 'GOOGLE'),
      kakao: parseProvider(env, 'KAKAO'),
      naver: parseProvider(env, 'NAVER'),
    },
    guardianVerificationMode: guardianVerificationMode as GuardianVerificationMode,
  };
}
