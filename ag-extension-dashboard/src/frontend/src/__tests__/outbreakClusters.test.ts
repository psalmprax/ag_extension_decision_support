import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/api/client';
import { outbreakService } from '@/api/efficacyService';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn() },
}));

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

describe('outbreakService.getClusters', () => {
  beforeEach(() => mockedGet.mockReset());

  it('returns the cluster list', async () => {
    const clusters = [{ id: 'c1', alert: true }];
    mockedGet.mockResolvedValue({ data: { success: true, data: clusters } });
    await expect(outbreakService.getClusters({ days: 14 })).resolves.toEqual(clusters);
    expect(mockedGet).toHaveBeenCalledWith('/outbreaks', { params: { days: 14 } });
  });

  it.each([{}, null, 'oops', { clusters: [] }])('rejects a non-list payload (%j) instead of passing it on', async payload => {
    mockedGet.mockResolvedValue({ data: { success: true, data: payload } });
    await expect(outbreakService.getClusters()).rejects.toThrow('Unexpected /outbreaks response');
  });
});
