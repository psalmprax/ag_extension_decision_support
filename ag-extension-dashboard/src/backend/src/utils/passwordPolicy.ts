import { z } from 'zod';

/**
 * Password policy shared by registration, reset and change-password.
 * - ≥ 10 characters, ≤ 128
 * - at least one letter and one digit
 * - not in a short list of the most common passwords
 * - must not contain the account's email local-part (checked at the route, needs email)
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', '1234567890', '12345678910',
  'qwertyuiop', 'qwerty1234', 'iloveyou12', 'letmein123', 'admin12345', 'welcome123',
  'changeme12', 'agriculture', 'farmer1234', 'extension1', 'gpexts1234', 'kenya12345',
]);

export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > 128) problems.push('at most 128 characters');
  if (!/[a-zA-Z]/.test(password)) problems.push('at least one letter');
  if (!/\d/.test(password)) problems.push('at least one number');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push('not a commonly used password');
  if (email) {
    const local = email.split('@')[0]?.toLowerCase();
    if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
      problems.push('must not contain your email name');
    }
  }
  return problems;
}

/** Zod schema for a password field (email cross-check happens via passwordProblems at the route). */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters')
  .refine(p => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Password must include at least one letter and one number')
  .refine(p => !COMMON_PASSWORDS.has(p.toLowerCase()), 'That password is too common');
