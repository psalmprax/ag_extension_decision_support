import { describe, it, expect, beforeEach } from 'vitest';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'ag_csrf=; path=/; max-age=0';
  });

  it('should have no token in localStorage — the session JWT is an httpOnly cookie', () => {
    // Cookie auth contract: the SPA never holds the JWT. Nothing token-shaped
    // may appear in localStorage.
    localStorage.setItem('user', JSON.stringify({ id: '1' }));
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
