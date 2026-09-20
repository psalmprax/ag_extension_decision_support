import bcrypt from 'bcryptjs';
import { logger } from '@/utils/logger';

/**
 * Compare a plaintext password against a stored bcrypt hash without ever throwing.
 *
 * A missing or malformed `password_hash` (legacy row, OAuth-created account,
 * truncated column value) previously propagated a bcrypt `Illegal arguments`
 * TypeError up to the route handler and surfaced as a generic 500. Failing
 * closed here turns that into a normal 401 invalid-credentials response.
 */
export async function verifyPassword(plainPassword: unknown, storedHash: unknown): Promise<boolean> {
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) return false;
    if (typeof storedHash !== 'string' || storedHash.length === 0) return false;
    try {
        return await bcrypt.compare(plainPassword, storedHash);
    } catch (error) {
        logger.warn('Password verification failed:', error instanceof Error ? error.message : 'unknown error');
        return false;
    }
}
