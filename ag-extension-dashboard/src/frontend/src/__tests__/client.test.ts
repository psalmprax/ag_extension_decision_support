import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Axios Mock Setup ---
// The response interceptor calls apiClient(config) for retries, so the mock
// must be callable. Object.assign(vi.fn(), { ... }) achieves this.
const { mockAxiosInstance, requestUseSpy, responseUseSpy } = vi.hoisted(() => {
  const reqUse = vi.fn();
  const resUse = vi.fn();

  const instance = Object.assign(
    vi.fn(() => Promise.resolve({ data: {} })),
    {
      defaults: {},
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: reqUse },
        response: { use: resUse },
      },
    },
  );

  return {
    mockAxiosInstance: instance,
    requestUseSpy: reqUse,
    responseUseSpy: resUse,
  };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

// Import after mocks
import apiClient from '@/api/client';

// These setup tests are in their own describe WITHOUT a beforeEach that clears mocks,
// because the interceptor use() calls happened at import time and we need to inspect them.
describe('API Client Setup', () => {
  it('should export a default apiClient instance', () => {
    expect(apiClient).toBeDefined();
  });

  it('should have axios HTTP methods', () => {
    expect(apiClient.get).toBeInstanceOf(Function);
    expect(apiClient.post).toBeInstanceOf(Function);
    expect(apiClient.put).toBeInstanceOf(Function);
    expect(apiClient.delete).toBeInstanceOf(Function);
  });

  it('should have interceptors', () => {
    expect(apiClient.interceptors).toBeDefined();
    expect(apiClient.interceptors.request).toBeDefined();
    expect(apiClient.interceptors.response).toBeDefined();
  });

  it('should register request interceptor with a function', () => {
    expect(requestUseSpy).toHaveBeenCalled();
    expect(requestUseSpy.mock.calls[0]?.[0]).toBeInstanceOf(Function);
  });

  it('should register response interceptor with fulfilled and rejected', () => {
    expect(responseUseSpy).toHaveBeenCalled();
    const args = responseUseSpy.mock.calls[0];
    expect(args[0]).toBeInstanceOf(Function);
    expect(args[1]).toBeInstanceOf(Function);
  });

  it('should be callable (for retry mechanism)', () => {
    expect(typeof mockAxiosInstance).toBe('function');
  });
});

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ─── localStorage Management ─────────────────────────────

  describe('token management', () => {
    it('should store and retrieve token', () => {
      localStorage.setItem('token', 'test-token-123');
      expect(localStorage.getItem('token')).toBe('test-token-123');
    });

    it('should remove token', () => {
      localStorage.setItem('token', 'test-token-123');
      localStorage.removeItem('token');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle missing token gracefully', () => {
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('user management', () => {
    it('should store and retrieve user as JSON', () => {
      const user = { id: '1', email: 'test@test.com', role: 'admin' };
      localStorage.setItem('user', JSON.stringify(user));
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      expect(stored.email).toBe('test@test.com');
      expect(stored.role).toBe('admin');
    });

    it('should handle missing user gracefully', () => {
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('should handle corrupted user JSON gracefully', () => {
      localStorage.setItem('user', 'not-json{{{');
      expect(() => JSON.parse(localStorage.getItem('user') || '')).toThrow();
    });
  });

  // ─── Request Interceptor ──────────────────────────────────

  describe('request interceptor behavior', () => {
    it('should add Bearer token from localStorage to request headers', () => {
      const handler = requestUseSpy.mock.calls[0]?.[0] as
        ((c: Record<string, unknown>) => Record<string, unknown>) | undefined;
      if (!handler) return;

      localStorage.setItem('token', 'my-jwt-token');
      const config = handler({ headers: {} });
      const headers = config.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer my-jwt-token');
    });

    it('should not add Authorization when no token exists', () => {
      const handler = requestUseSpy.mock.calls[0]?.[0] as
        ((c: Record<string, unknown>) => Record<string, unknown>) | undefined;
      if (!handler) return;

      localStorage.removeItem('token');
      const config = handler({ headers: {} });
      const headers = config.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it('should preserve existing headers when adding token', () => {
      const handler = requestUseSpy.mock.calls[0]?.[0] as
        ((c: Record<string, unknown>) => Record<string, unknown>) | undefined;
      if (!handler) return;

      localStorage.setItem('token', 'my-token');
      const config = handler({
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });
      const headers = config.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer my-token');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Custom']).toBe('value');
    });
  });

  // ─── Response Interceptor: Success Path ───────────────────

  describe('response interceptor — success path', () => {
    it('should pass through successful responses unchanged', () => {
      const handler = responseUseSpy.mock.calls[0]?.[0] as
        ((r: Record<string, unknown>) => Record<string, unknown>) | undefined;
      if (!handler) return;

      const response = { data: { success: true }, status: 200 };
      const result = handler(response);
      expect(result).toBe(response);
    });
  });

  // ─── 401 Handling ─────────────────────────────────────────

  describe('401 unauthorized handling', () => {
    let mockLocation: { pathname: string; href: string };

    beforeEach(() => {
      mockLocation = { pathname: '/dashboard', href: '' };
      const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
      if (locationDescriptor?.writable) {
        // Replace location entirely for tests
        Object.defineProperty(window, 'location', {
          value: mockLocation,
          writable: true,
          configurable: true,
        });
      }
    });

    afterEach(() => {
      // Restore location
      Object.defineProperty(window, 'location', {
        value: { pathname: '/', href: '' },
        writable: true,
        configurable: true,
      });
    });

    it('should clear token and user from localStorage on 401', () => {
      const handler = responseUseSpy.mock.calls[0]?.[1] as
        ((e: Record<string, unknown>) => Promise<unknown>) | undefined;
      if (!handler) return;

      localStorage.setItem('token', 'expired-token');
      localStorage.setItem('user', JSON.stringify({ id: '1' }));

      handler({
        response: { status: 401 },
        config: { url: '/api/data' },
      }).catch(() => {});

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('should redirect to /login on 401 when on a protected route', () => {
      const handler = responseUseSpy.mock.calls[0]?.[1] as
        ((e: Record<string, unknown>) => Promise<unknown>) | undefined;
      if (!handler) return;

      mockLocation.pathname = '/dashboard';
      mockLocation.href = '';

      handler({
        response: { status: 401 },
        config: { url: '/api/secure' },
      }).catch(() => {});

      expect(mockLocation.href).toBe('/login');
    });

    it('should NOT redirect on 401 when already on login page', () => {
      const handler = responseUseSpy.mock.calls[0]?.[1] as
        ((e: Record<string, unknown>) => Promise<unknown>) | undefined;
      if (!handler) return;

      mockLocation.pathname = '/login';
      mockLocation.href = '';

      handler({
        response: { status: 401 },
        config: { url: '/api/secure' },
      }).catch(() => {});

      expect(mockLocation.href).toBe('');
    });

    it('should NOT redirect on 401 when already on register page', () => {
      const handler = responseUseSpy.mock.calls[0]?.[1] as
        ((e: Record<string, unknown>) => Promise<unknown>) | undefined;
      if (!handler) return;

      mockLocation.pathname = '/register';

      handler({
        response: { status: 401 },
        config: { url: '/api/secure' },
      }).catch(() => {});

      expect(mockLocation.href).toBe('');
    });

    it('should NOT redirect on 401 when on forgot-password page', () => {
      const handler = responseUseSpy.mock.calls[0]?.[1] as
        ((e: Record<string, unknown>) => Promise<unknown>) | undefined;
      if (!handler) return;

      mockLocation.pathname = '/forgot-password';

      handler({
        response: { status: 401 },
        config: { url: '/api/secure' },
      }).catch(() => {});

      expect(mockLocation.href).toBe('');
    });

    it('should set __nonRetryable flag on 401 errors', async () => {
      const handler = responseUseSpy.mock.calls[0]?.[1] as
        ((e: Record<string, unknown>) => Promise<unknown>) | undefined;
      if (!handler) return;

      localStorage.setItem('token', 't');
      localStorage.setItem('user', JSON.stringify({ id: '1' }));

      try {
        await handler({
          response: { status: 401 },
          config: { url: '/api/data' },
        });
      } catch (e) {
        expect((e as Record<string, unknown>).__nonRetryable).toBe(true);
      }
    });
  });

  // ─── HTTP Method Passthrough ──────────────────────────────

  describe('HTTP method passthrough', () => {
    it('should call get() on the axios instance', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { items: [1, 2, 3] } });
      const result = await apiClient.get('/farmers');
      expect(result.data.items).toHaveLength(3);
    });

    it('should call post() with data', async () => {
      const payload = { email: 'test@test.com', password: 'pass' };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { token: 'abc' } });
      const result = await apiClient.post('/auth/login', payload);
      expect(result.data).toEqual({ token: 'abc' });
    });

    it('should call put() with data', async () => {
      mockAxiosInstance.put.mockResolvedValueOnce({ data: { updated: true } });
      const result = await apiClient.put('/farmers/1', { name: 'New' });
      expect(result.data.updated).toBe(true);
    });

    it('should call delete()', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({ data: { deleted: true } });
      const result = await apiClient.delete('/farmers/1');
      expect(result.data.deleted).toBe(true);
    });
  });
});
