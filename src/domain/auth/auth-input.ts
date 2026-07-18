import { z } from 'zod';
import { normalizeLoginIdentifier } from '../../lib/account.ts';

const normalizedEmail = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const loginIdentifier = z.string()
  .trim()
  .min(1)
  .max(254)
  .transform(normalizeLoginIdentifier)
  .refine((value) => value.length <= 254, 'Login identifier is too long.');
const password = z.string()
  .min(12)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export const loginInputSchema = z.object({
  email: loginIdentifier,
  password: z.string().min(1).max(256),
  remember: z.boolean().optional().default(false),
});

export const registrationInputSchema = z.object({
  email: normalizedEmail,
  password,
  passwordConfirmation: z.string().max(128),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
}).superRefine((value, context) => {
  if (value.password !== value.passwordConfirmation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['passwordConfirmation'], message: 'Passwords do not match.' });
  }
});

const birthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Birth date is invalid.');

export const profileCompletionSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  birthDate,
  phone: z.string().trim().min(7).max(30).optional(),
  termsVersion: z.string().trim().min(1).max(50),
  privacyVersion: z.string().trim().min(1).max(50),
});

export const recoveryInputSchema = z.object({ email: normalizedEmail });
export const passwordChangeInputSchema = z.object({ password });
