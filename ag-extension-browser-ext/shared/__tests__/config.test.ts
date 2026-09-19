import { describe, it, expect } from 'vitest';
import CONFIG, {
  isLocalhost,
  resolveEffectiveEnv,
  DEFAULT_DEV_API_BASE_URL,
  DEFAULT_PROD_API_BASE_URL,
  apiUrl,
  healthUrl,
} from '../config';

describe('browser extension config', () => {
  describe('isLocalhost', () => {
    it('identifies localhost addresses correctly', () => {
      expect(isLocalhost('http://localhost:7500/api/v1')).toBe(true);
      expect(isLocalhost('http://127.0.0.1:7500/api/v1')).toBe(true);
      expect(isLocalhost('https://127.0.0.1:7500/api/v1')).toBe(true);
      expect(isLocalhost('http://[::1]:7500/api/v1')).toBe(true);
      expect(isLocalhost('http://sub.localhost:8080/test')).toBe(true);
    });

    it('identifies non-localhost addresses correctly', () => {
      expect(isLocalhost('https://api.gpexts.com/api/v1')).toBe(false);
      expect(isLocalhost('https://example.com/api')).toBe(false);
      expect(isLocalhost('')).toBe(false);
      expect(isLocalhost('invalid-url')).toBe(false);
    });
  });

  describe('resolveEffectiveEnv', () => {
    it('does not falsely report production when defaulting to a local dev environment', () => {
      // Localhost with undefined mode defaults to development
      expect(resolveEffectiveEnv(undefined, DEFAULT_DEV_API_BASE_URL)).toBe('development');

      // Localhost even with production mode is coerced to development
      expect(resolveEffectiveEnv('production', DEFAULT_DEV_API_BASE_URL)).toBe('development');
      expect(resolveEffectiveEnv('production', 'http://127.0.0.1:7500/api/v1')).toBe('development');
    });

    it('retains explicit non-production modes when using localhost', () => {
      expect(resolveEffectiveEnv('test', DEFAULT_DEV_API_BASE_URL)).toBe('test');
      expect(resolveEffectiveEnv('development', DEFAULT_DEV_API_BASE_URL)).toBe('development');
    });

    it('reports production for production hosts when in production mode', () => {
      expect(resolveEffectiveEnv('production', DEFAULT_PROD_API_BASE_URL)).toBe('production');
      expect(resolveEffectiveEnv(undefined, DEFAULT_PROD_API_BASE_URL)).toBe('production');
    });
  });

  describe('URL helpers', () => {
    it('constructs correct healthUrl', async () => {
      const health = await healthUrl();
      expect(health).toMatch(/\/health$/);
    });

    it('constructs correct apiUrl', async () => {
      const urlWithSlash = await apiUrl('/farmers');
      const urlWithoutSlash = await apiUrl('farmers');
      expect(urlWithSlash).toMatch(/\/farmers$/);
      expect(urlWithoutSlash).toMatch(/\/farmers$/);
      expect(urlWithSlash).toBe(urlWithoutSlash);
    });
  });

  describe('CONFIG exports', () => {
    it('provides valid configuration constants', () => {
      expect(CONFIG.VERSION).toBe('1.0.0');
      expect(CONFIG.OFFLINE_MODE_ENABLED).toBe(true);
      expect(CONFIG.VISIT_LOGGING_ENABLED).toBe(true);
      expect(typeof CONFIG.API_BASE_URL).toBe('string');
      expect(typeof CONFIG.ENV).toBe('string');
    });
  });
});
