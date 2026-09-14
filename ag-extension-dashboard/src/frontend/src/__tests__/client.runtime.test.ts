import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { type AxiosError } from 'axios';
import apiClient, { getRetryDelay, shouldRetry } from '@/api/client';
import { RemoteWipeService } from '@/services/remoteWipeService';

vi.mock('@/services/remoteWipeService', () => ({
  RemoteWipeService: { evaluateSignal: vi.fn() },
}));

const mockedWipe = vi.mocked(RemoteWipeService.evaluateSignal);

describe('API client runtime behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedWipe.mockReset();
    window.history.replaceState({}, '', '/login');
  });

  it('adds the CSRF header to mutating requests when the session cookie exists', async () => {
    // Cookie auth: session JWT is httpOnly (invisible to JS); the readable
    // ag_csrf cookie is echoed in the x-csrf-token header on mutations.
    document.cookie = 'ag_csrf=csrf-token-123; path=/';
    const handlers = apiClient.interceptors.request.handlers!;
    const config = await handlers[0].fulfilled!({ method: 'post', url: '/farmers', headers: {} } as never);
    expect(config.headers['x-csrf-token']).toBe('csrf-token-123');
    expect(config.headers.Authorization).toBeUndefined();
    document.cookie = 'ag_csrf=; path=/; max-age=0';
  });

  it('omits the CSRF header on safe methods and CSRF-exempt auth endpoints', async () => {
    document.cookie = 'ag_csrf=csrf-token-123; path=/';
    const handlers = apiClient.interceptors.request.handlers!;
    const safeConfig = await handlers[0].fulfilled!({ method: 'get', url: '/farmers', headers: {} } as never);
    expect(safeConfig.headers['x-csrf-token']).toBeUndefined();
    const exemptConfig = await handlers[0].fulfilled!({ method: 'post', url: '/auth/login', headers: {} } as never);
    expect(exemptConfig.headers['x-csrf-token']).toBeUndefined();
    document.cookie = 'ag_csrf=; path=/; max-age=0';
  });

  it('blocks requests containing synthetic demo identifiers', async () => {
    const handler = apiClient.interceptors.request.handlers![1].fulfilled!;
    await expect(handler({ url: '/farmers/demo-farmer-1' } as never)).rejects.toMatchObject({
      code: 'ERR_DEMO_BLOCKED',
    });
  });

  it('clears the session and rejects unauthorized responses without retrying', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh unavailable'));
    document.cookie = 'ag_csrf=csrf-token-123; path=/';
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    const handler = apiClient.interceptors.response.handlers![0].rejected!;
    const error = { response: { status: 401 }, config: {} } as never;

    await expect(handler(error)).rejects.toMatchObject({ __nonRetryable: true });
    expect(localStorage.getItem('user')).toBeNull();
    document.cookie = 'ag_csrf=; path=/; max-age=0';
  });

  it('evaluates remote wipe signals for forbidden responses', async () => {
    const handler = apiClient.interceptors.response.handlers![0].rejected!;
    const error = { response: { status: 403, data: { wipeSignal: true } }, config: {} } as never;

    await expect(handler(error)).rejects.toBe(error);
    expect(mockedWipe).toHaveBeenCalledWith({ wipeSignal: true }, 403);
  });

  it('retries only transient failures and applies exponential backoff', () => {
    const transient = { response: { status: 503 }, config: {} } as AxiosError;
    const clientError = { response: { status: 400 }, config: {} } as AxiosError;
    const networkError = { code: 'ECONNABORTED', config: {} } as AxiosError;

    expect(shouldRetry(transient)).toBe(true);
    expect(shouldRetry(clientError)).toBe(false);
    expect(shouldRetry(networkError)).toBe(false);
    expect(getRetryDelay(0)).toBe(1000);
    expect(getRetryDelay(1)).toBe(2000);
    expect(getRetryDelay(2)).toBe(4000);
  });
});
