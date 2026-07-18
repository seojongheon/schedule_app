export type RequestPolicy = {
  windowSeconds: number;
  allowThrough: number;
  hardLimit: number;
  delayMinMs?: number;
  delayMaxMs?: number;
  blockAfterHardExcesses: number;
  hardExcessLookbackSeconds: number;
  blockSeconds: number;
};

export const GENERAL_REQUEST_POLICY: Readonly<RequestPolicy> = Object.freeze({
  windowSeconds: 60,
  allowThrough: 90,
  hardLimit: 120,
  delayMinMs: 1000,
  delayMaxMs: 3000,
  blockAfterHardExcesses: 3,
  hardExcessLookbackSeconds: 10 * 60,
  blockSeconds: 15 * 60,
});

export const SENSITIVE_REQUEST_POLICY: Readonly<RequestPolicy> = Object.freeze({
  windowSeconds: 5 * 60,
  allowThrough: 20,
  hardLimit: 20,
  blockAfterHardExcesses: 3,
  hardExcessLookbackSeconds: 10 * 60,
  blockSeconds: 15 * 60,
});

export type RequestPolicyDecision =
  | { action: "allow" }
  | { action: "delay"; delayMs: number }
  | { action: "reject"; retryAfterSeconds: number; recordHardExcess: true }
  | {
      action: "block";
      blockedUntil: string;
      retryAfterSeconds: number;
      recordHardExcess?: true;
    };

function validTime(value: Date): number {
  const time = value.getTime();
  if (!Number.isFinite(time)) throw new Error("Invalid request policy time.");
  return time;
}

function retryAfter(
  nowMs: number,
  windowStartedAt: Date | undefined,
  windowSeconds: number,
): number {
  if (!windowStartedAt) return windowSeconds;
  const elapsedSeconds = Math.floor((nowMs - validTime(windowStartedAt)) / 1000);
  return Math.max(1, windowSeconds - Math.max(0, elapsedSeconds));
}

export function decideRequestPolicy(input: {
  policy: Readonly<RequestPolicy>;
  count: number;
  now?: Date;
  windowStartedAt?: Date;
  blockedUntil?: Date;
  hardExcessesInTenMinutes?: number;
  randomFraction?: number;
}): RequestPolicyDecision {
  const nowMs = validTime(input.now ?? new Date());
  if (!Number.isInteger(input.count) || input.count < 0) {
    throw new Error("Request count must be a non-negative integer.");
  }

  if (input.blockedUntil) {
    const blockedUntilMs = validTime(input.blockedUntil);
    if (blockedUntilMs > nowMs) {
      return {
        action: "block",
        blockedUntil: input.blockedUntil.toISOString(),
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntilMs - nowMs) / 1000)),
      };
    }
  }

  if (input.count > input.policy.hardLimit) {
    const priorExcesses = input.hardExcessesInTenMinutes ?? 0;
    if (priorExcesses + 1 >= input.policy.blockAfterHardExcesses) {
      const blockedUntil = new Date(nowMs + input.policy.blockSeconds * 1000);
      return {
        action: "block",
        blockedUntil: blockedUntil.toISOString(),
        retryAfterSeconds: input.policy.blockSeconds,
        recordHardExcess: true,
      };
    }
    return {
      action: "reject",
      retryAfterSeconds: retryAfter(nowMs, input.windowStartedAt, input.policy.windowSeconds),
      recordHardExcess: true,
    };
  }

  if (input.count > input.policy.allowThrough) {
    const fraction = input.randomFraction ?? Math.random();
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
      throw new Error("Random fraction must be between zero and one.");
    }
    const minimum = input.policy.delayMinMs;
    const maximum = input.policy.delayMaxMs;
    if (minimum === undefined || maximum === undefined) {
      throw new Error("Request policy delay bounds are required for the delay band.");
    }
    return {
      action: "delay",
      delayMs: minimum + Math.round(fraction * (maximum - minimum)),
    };
  }

  return { action: "allow" };
}
