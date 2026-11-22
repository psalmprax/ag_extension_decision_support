import { describe, expect, it, vi } from 'vitest';
import apiClient from '@/api/client';
import { fetchFarmers } from '@/api/farmerService';

vi.unmock('@/api/farmerService');
vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }));

const farmer = (n: number) => ({ id: `f-${n}`, firstName: `Farmer ${n}`, lastName: 'Phiri', region: 'Mzuzu' });
const page = (from: number, count: number, total: number) => ({
  data: { success: true, data: { farmers: Array.from({ length: count }, (_, i) => farmer(from + i)), total } },
});

describe('fetchFarmers', () => {
  it('reads every page, not just the first', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(page(0, 500, 1_120) as never)
      .mockResolvedValueOnce(page(500, 500, 1_120) as never)
      .mockResolvedValueOnce(page(1_000, 120, 1_120) as never);

    const result = await fetchFarmers();

    expect(result.data.farmers).toHaveLength(1_120);
    expect(result.data.total).toBe(1_120);
    expect(vi.mocked(apiClient.get).mock.calls.map(call => (call[1] as { params: { offset: number } }).params.offset)).toEqual([0, 500, 1_000]);
  });

  it('makes one request when everything fits on the first page', async () => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValueOnce(page(0, 37, 37) as never);
    const result = await fetchFarmers();
    expect(result.data.farmers).toHaveLength(37);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
