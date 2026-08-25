import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { apiQueue } from '../apiQueue';

type SendMessageImpl = (message: unknown) => Promise<unknown>;

const mockSendMessage = (impl: SendMessageImpl) => {
  fakeBrowser.runtime.sendMessage = vi.fn(impl) as unknown as typeof fakeBrowser.runtime.sendMessage;
};

const sendMessageCalls = (action: string): unknown[] =>
  (fakeBrowser.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>).mock.calls
    .map((call) => call[0] as { action?: string })
    .filter((message) => message.action === action);

describe('apiQueue', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('queues a mutation when offline and returns a queued response', async () => {
    mockSendMessage(async (message) => {
      const { action } = message as { action: string };
      if (action === 'get_offline_status') return { success: true, status: { isOnline: false, lastChecked: 0 } };
      if (action === 'queue_request') return { success: true };
      return { success: false, error: 'unexpected action' };
    });

    const response = await apiQueue.makeRequest('https://api.example.test/farmers/1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Farmer' }),
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, queued: true });

    const queueCalls = sendMessageCalls('queue_request');
    expect(queueCalls).toHaveLength(1);
    const queued = (queueCalls[0] as { request: { url: string; method: string; maxRetries: number } }).request;
    expect(queued.url).toBe('https://api.example.test/farmers/1');
    expect(queued.method).toBe('POST');
    expect(queued.maxRetries).toBe(3);
  });

  it('performs a fetch directly when online', async () => {
    mockSendMessage(async (message) => {
      const { action } = message as { action: string };
      if (action === 'get_offline_status') return { success: true, status: { isOnline: true, lastChecked: 0 } };
      return { success: false, error: 'unexpected action' };
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiQueue.makeRequest('https://api.example.test/farmers', { method: 'GET' });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/farmers', expect.objectContaining({ method: 'GET' }));
    expect(sendMessageCalls('queue_request')).toHaveLength(0);
  });

  it('propagates queueing failures when offline', async () => {
    mockSendMessage(async (message) => {
      const { action } = message as { action: string };
      if (action === 'get_offline_status') return { success: true, status: { isOnline: false, lastChecked: 0 } };
      if (action === 'queue_request') return { success: false, error: 'queue storage unavailable' };
      return { success: false, error: 'unexpected action' };
    });

    await expect(
      apiQueue.makeRequest('https://api.example.test/visits', { method: 'POST', body: '{}' })
    ).rejects.toThrow('queue storage unavailable');
  });

  it('rejects non-replayable bodies when offline', async () => {
    mockSendMessage(async (message) => {
      const { action } = message as { action: string };
      if (action === 'get_offline_status') return { success: true, status: { isOnline: false, lastChecked: 0 } };
      return { success: false, error: 'unexpected action' };
    });

    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', file);

    await expect(
      apiQueue.makeRequest('https://api.example.test/upload', { method: 'POST', body: formData })
    ).rejects.toThrow('File uploads require an active connection');
  });

  it('returns queued requests reported by the background', async () => {
    const queued = [
      {
        id: 'req-1',
        idempotencyKey: 'req-1',
        url: 'https://api.example.test/visits',
        method: 'POST',
        headers: {},
        timestamp: 1234,
        retries: 0,
        maxRetries: 3,
        state: 'pending' as const,
      },
    ];
    mockSendMessage(async (message) => {
      const { action } = message as { action: string };
      if (action === 'get_queued_requests') return { success: true, requests: queued };
      return { success: false, error: 'unexpected action' };
    });

    const requests = await apiQueue.getQueuedRequests();
    expect(requests).toEqual(queued);
  });

  it('requests a sync from the background', async () => {
    mockSendMessage(async (message) => {
      const { action } = message as { action: string };
      if (action === 'sync_now') return { success: true };
      return { success: false, error: 'unexpected action' };
    });

    await expect(apiQueue.syncNow()).resolves.toBeUndefined();
  });
});
