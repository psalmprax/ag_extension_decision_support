import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSW } from 'virtual:pwa-register';
import { registerServiceWorker } from '@/lib/swRegistration';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));

describe('service worker registration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('registers immediately and returns the update function', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    vi.mocked(registerSW).mockReturnValueOnce(update);

    expect(registerServiceWorker()).toBe(update);
    expect(registerSW).toHaveBeenLastCalledWith({
      immediate: true,
      onRegisterError: expect.any(Function),
      onRegistered: expect.any(Function),
    });
  });

  it('reports registration failures in development without throwing', () => {
    vi.stubEnv('DEV', true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerServiceWorker();
    const options = vi.mocked(registerSW).mock.lastCall?.[0];

    expect(options?.onRegisterError).toBeTypeOf('function');
    expect(() => options?.onRegisterError?.(new Error('registration failed'))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Service worker registration failed'),
      'registration failed'
    );
  });

  it('logs only successful registrations in development', () => {
    vi.stubEnv('DEV', true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    registerServiceWorker();
    const options = vi.mocked(registerSW).mock.lastCall?.[0];
    const registration = { scope: '/' } as ServiceWorkerRegistration;

    options?.onRegistered?.(undefined);
    expect(log).not.toHaveBeenCalled();
    options?.onRegistered?.(registration);
    expect(log).toHaveBeenCalledWith('[SW] Service worker registered successfully');
  });

  it('does not log registration callbacks in production', () => {
    vi.stubEnv('DEV', false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    registerServiceWorker();
    const options = vi.mocked(registerSW).mock.lastCall?.[0];

    options?.onRegisterError?.(new Error('registration failed'));
    options?.onRegistered?.({ scope: '/' } as ServiceWorkerRegistration);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
