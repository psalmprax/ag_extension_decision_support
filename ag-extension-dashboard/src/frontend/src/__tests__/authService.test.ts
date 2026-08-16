import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '@/api/client';
import { login, demoLogin, register, fetchUserProfile, logout } from '../api/authService';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    it('should send credentials and return auth response', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'jwt-token-123',
            user: {
              id: '1',
              email: 'test@test.com',
              role: 'admin' as const,
              firstName: 'Test',
              lastName: 'User',
            },
          },
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await login({ email: 'test@test.com', password: 'password123' });

      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'password123',
      });
      expect(result.data.token).toBe('jwt-token-123');
      expect(result.data.user.email).toBe('test@test.com');
    });

    it('should throw on invalid credentials', async () => {
      mockPost.mockRejectedValue({
        response: { data: { error: 'Invalid credentials' } },
      });

      await expect(login({ email: 'bad@test.com', password: 'wrong' })).rejects.toThrow();
    });
  });

  describe('demoLogin', () => {
    it('should call demo endpoint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'demo-token',
            user: {
              id: '1',
              email: 'demo@agridemo.com',
              role: 'extension_officer' as const,
              firstName: 'Demo',
              lastName: 'User',
            },
          },
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await demoLogin();

      expect(mockPost).toHaveBeenCalledWith('/auth/demo');
      expect(result.data.token).toBe('demo-token');
    });
  });

  describe('register', () => {
    it('should send registration data', async () => {
      mockPost.mockResolvedValue({
        data: {
          success: true,
          data: {
            token: 'new-token',
            user: {
              id: '2',
              email: 'new@test.com',
              role: 'farmer' as const,
              firstName: 'New',
              lastName: 'User',
            },
          },
        },
      });

      const result = await register({
        email: 'new@test.com',
        password: 'pass123',
        firstName: 'New',
        lastName: 'User',
        role: 'farmer',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({
          email: 'new@test.com',
        })
      );
      expect(result.data.token).toBe('new-token');
    });
  });

  describe('fetchUserProfile', () => {
    it('should fetch current user profile', async () => {
      mockGet.mockResolvedValue({
        data: {
          success: true,
          data: {
            id: '1',
            email: 'test@test.com',
            role: 'admin',
            firstName: 'Test',
            lastName: 'User',
          },
        },
      });

      const result = await fetchUserProfile();

      expect(mockGet).toHaveBeenCalledWith('/auth/me');
      expect(result.data.email).toBe('test@test.com');
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      mockPost.mockResolvedValue({ data: {} });

      await logout();

      expect(mockPost).toHaveBeenCalledWith('/auth/logout');
    });

    it('should handle logout API failure gracefully', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      // Should not throw — logout is best-effort
      await expect(logout()).resolves.not.toThrow();
    });
  });
});
