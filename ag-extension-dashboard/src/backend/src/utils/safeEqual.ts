import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of a secret someone sent (a link signature, a callback secret)
 * with the expected one. Unequal byte lengths are a plain mismatch: `timingSafeEqual`
 * itself throws on them, which turned a bad multi-byte value into a server error.
 */
export function safeEqual(received: unknown, expected: string): boolean {
    if (typeof received !== 'string') return false;
    const a = Buffer.from(received, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
}
