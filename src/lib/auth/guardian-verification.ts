export type GuardianVerificationMode = 'disabled' | 'test' | 'provider';

type StartResult =
  | { status: 'unavailable' }
  | { status: 'pending'; evidenceReference: string };
type VerifyResult =
  | { status: 'unavailable' }
  | { status: 'approved' }
  | { status: 'rejected' };

export type GuardianVerificationAdapter = {
  start(input: { childUserId: string }): Promise<StartResult>;
  verify(input: { evidenceReference: string }): Promise<VerifyResult>;
};

export function createGuardianVerificationAdapter(input: {
  mode: GuardianVerificationMode;
  environment: 'development' | 'test' | 'production';
}): GuardianVerificationAdapter {
  if (input.mode === 'test' && input.environment === 'production') {
    throw new Error('The test guardian adapter is forbidden in production.');
  }

  if (input.mode !== 'test') {
    return {
      async start() { return { status: 'unavailable' }; },
      async verify() { return { status: 'unavailable' }; },
    };
  }

  return {
    async start({ childUserId }) {
      return { status: 'pending', evidenceReference: `test:${childUserId}` };
    },
    async verify({ evidenceReference }) {
      if (evidenceReference.endsWith(':approve')) return { status: 'approved' };
      return { status: 'rejected' };
    },
  };
}
