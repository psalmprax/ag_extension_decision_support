import { resolveJwtSecret } from '../config';

describe('JWT secret policy', () => {
    it('requires an explicitly configured staging secret', () => {
        expect(() => resolveJwtSecret('staging', '')).toThrow(/JWT_SECRET is required/);
    });

    it('rejects short staging secrets instead of padding them', () => {
        expect(() => resolveJwtSecret('staging', 'too-short')).toThrow(/at least 32 characters/);
    });

    it('accepts a sufficiently long staging secret', () => {
        const secret = 'staging-secret-with-at-least-thirty-two-characters';
        expect(resolveJwtSecret('staging', secret)).toBe(secret);
    });

    it('retains the development fallback only in development and test', () => {
        expect(resolveJwtSecret('development', '')).toBe('dev-secret-key-for-local-only');
        expect(resolveJwtSecret('test', '')).toBe('dev-secret-key-for-local-only');
    });
});
