import { withSensitiveRateLimit } from '@/lib/rate-limit/with-rate-limit';
import { redeemInviteHandler } from '../invite-handlers';

export const POST = withSensitiveRateLimit(redeemInviteHandler);
