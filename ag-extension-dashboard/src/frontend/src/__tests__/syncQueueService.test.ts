import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({
  default: {
    request: vi.fn(),
  },
}));

import apiClient from '@/api/client';
import { syncQueue } from '@/api/syncQueueService';

const mockRequest = vi.mocked(apiClient.request);

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('syncQueueService', () => {
  beforeEach(() => {
    syncQueue.clear();
    mockRequest.mockReset();
    setOnline(true);
  });

  it('assigns a stable idempotency key and persists a pending mutation', () => {
    const id = syncQueue.enqueue({
      action: 'create',
      entity: 'visit',
      endpoint: '/visits',
      method: 'POST',
      data: { farmer_id: 'farmer-1' },
    });

    const [item] = syncQueue.getQueue();
    expect(item.id).toBe(id);
    expect(item.idempotencyKey).toBe(id);
    expect(item.state).toBe('pending');
    expect(JSON.parse(localStorage.getItem('ag-sync-queue') || '[]')).toHaveLength(1);
  });

  it('replays a mutation with its idempotency header and removes it on success', async () => {
    mockRequest.mockResolvedValue({ status: 201 } as never);
    const id = syncQueue.enqueue({
      action: 'create',
      entity: 'visit',
      endpoint: '/visits',
      method: 'POST',
      data: { farmer_id: 'farmer-1' },
    });

    const result = await syncQueue.processQueue();

    expect(result).toEqual({ success: 1, failed: 0, conflicts: 0 });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: '/visits',
      headers: { 'Idempotency-Key': id },
    }));
    expect(syncQueue.getQueue()).toEqual([]);
  });

  it('retains a conflict for explicit review and retry', async () => {
    mockRequest.mockRejectedValue({
      response: { status: 409, data: { error: 'Mutation key reused' } },
    });
    const id = syncQueue.enqueue({
      action: 'update',
      entity: 'visit',
      endpoint: '/visits/visit-1',
      method: 'PATCH',
      data: { status: 'completed' },
    });

    const result = await syncQueue.processQueue();
    const [item] = syncQueue.getQueue();

    expect(result.conflicts).toBe(1);
    expect(item.id).toBe(id);
    expect(item.state).toBe('conflict');
    expect(item.lastError).toBe('Mutation key reused');

    syncQueue.retry(id);
    expect(syncQueue.getQueue()[0].state).toBe('pending');
  });

  it('retries transient failures and marks the mutation failed at the retry limit', async () => {
    mockRequest.mockRejectedValue(new Error('Network unavailable'));
    syncQueue.enqueue({
      action: 'create',
      entity: 'visit',
      endpoint: '/visits',
      method: 'POST',
      data: { farmer_id: 'farmer-1' },
    });

    expect((await syncQueue.processQueue()).failed).toBe(0);
    expect((await syncQueue.processQueue()).failed).toBe(0);
    expect((await syncQueue.processQueue()).failed).toBe(1);

    const [item] = syncQueue.getQueue();
    expect(item.state).toBe('failed');
    expect(item.retryCount).toBe(3);
    expect(item.lastError).toBe('Network unavailable');
  });
});
