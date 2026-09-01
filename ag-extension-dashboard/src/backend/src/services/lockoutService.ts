import { query } from './databaseService';
import { logger } from '../utils/logger';

// fallow-ignore-next-line unused-export
export const MAX_FAILED_ATTEMPTS = 5;
// fallow-ignore-next-line unused-export
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutCheckResult {
  locked: boolean;
  remainingSeconds: number;
  lockoutUntil: Date | null;
}

export function isAccountLocked(lockoutUntil?: Date | string | null): LockoutCheckResult {
  if (!lockoutUntil) {
    return { locked: false, remainingSeconds: 0, lockoutUntil: null };
  }

  const lockoutDate = new Date(lockoutUntil);
  const now = Date.now();

  if (lockoutDate.getTime() > now) {
    const remainingSeconds = Math.ceil((lockoutDate.getTime() - now) / 1000);
    return { locked: true, remainingSeconds, lockoutUntil: lockoutDate };
  }

  return { locked: false, remainingSeconds: 0, lockoutUntil: null };
}

export async function recordFailedLogin(userId: string): Promise<{
  locked: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockoutUntil: Date | null;
}> {
  try {
    const res = await query(
      `
      SELECT failed_login_attempts, lockout_until
      FROM users
      WHERE id = $1
    `,
      [userId]
    );

    if (res.rows.length === 0) {
      return { locked: false, failedAttempts: 1, remainingAttempts: MAX_FAILED_ATTEMPTS - 1, lockoutUntil: null };
    }

    const currentAttempts = (res.rows[0].failed_login_attempts || 0) + 1;
    let lockoutUntil: Date | null = null;
    let locked = false;

    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      locked = true;
      logger.warn(`User ${userId} locked out due to ${currentAttempts} consecutive failed attempts`);
    }

    await query(
      `
      UPDATE users
      SET failed_login_attempts = $1,
          lockout_until = $2
      WHERE id = $3
    `,
      [currentAttempts, lockoutUntil, userId]
    );

    return {
      locked,
      failedAttempts: currentAttempts,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - currentAttempts),
      lockoutUntil,
    };
  } catch (error) {
    logger.error('Failed to record failed login in lockoutService:', error);
    return { locked: false, failedAttempts: 1, remainingAttempts: MAX_FAILED_ATTEMPTS - 1, lockoutUntil: null };
  }
}

export async function resetFailedAttempts(userId: string): Promise<void> {
  try {
    await query(
      `
      UPDATE users
      SET failed_login_attempts = 0,
          lockout_until = NULL
      WHERE id = $1
    `,
      [userId]
    );
  } catch (error) {
    logger.error('Failed to reset failed login attempts:', error);
  }
}
