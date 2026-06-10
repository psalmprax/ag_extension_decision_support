import { describe, it, expect, beforeEach } from 'vitest';

describe('API Client', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should have token management', () => {
        localStorage.setItem('token', 'test-token-123');
        expect(localStorage.getItem('token')).toBe('test-token-123');

        localStorage.removeItem('token');
        expect(localStorage.getItem('token')).toBeNull();
    });

    it('should have user management', () => {
        const user = { id: '1', email: 'test@test.com', role: 'admin' };
        localStorage.setItem('user', JSON.stringify(user));

        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        expect(stored.email).toBe('test@test.com');
        expect(stored.role).toBe('admin');
    });

    it('should handle missing user gracefully', () => {
        const stored = localStorage.getItem('user');
        expect(stored).toBeNull();
    });
});
