import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/api/client';
import { fetchNDVITimeSeries } from '@/api/agriDataService';

vi.mock('@/api/client', () => ({
  default: { get: vi.fn() },
}));

const mockedGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedGet.mockReset();
});

function backendPayload(data: unknown[]) {
  return {
    data: {
      success: true,
      data: { data, source: 'nasa-power-agroclimate-proxy', dataStatus: 'estimated', reason: 'r' },
    },
  };
}

describe('fetchNDVITimeSeries contract mapping', () => {
  it('maps backend vigor-proxy points to the NDVIPoint contract', async () => {
    mockedGet.mockResolvedValueOnce(
      backendPayload([
        { date: '2026-08-01', vigor: 0.62 },
        { date: '2026-08-02', vigor: 0.41 },
      ])
    );
    const res = await fetchNDVITimeSeries(-1.28, 36.81, 14);
    expect(res.data).toEqual([
      { date: '2026-08-01', ndvi: 0.62 },
      { date: '2026-08-02', ndvi: 0.41 },
    ]);
  });

  it('prefers an explicit ndvi value when present', async () => {
    mockedGet.mockResolvedValueOnce(
      backendPayload([{ date: '2026-08-01', ndvi: 0.7, vigor: 0.2 }])
    );
    const res = await fetchNDVITimeSeries(-1.28, 36.81, 14);
    expect(res.data).toEqual([{ date: '2026-08-01', ndvi: 0.7 }]);
  });

  it('drops points with no finite value so charts never render NaN', async () => {
    mockedGet.mockResolvedValueOnce(
      backendPayload([
        { date: '2026-08-01' },
        { date: '2026-08-02', vigor: Number.NaN },
        { date: '2026-08-03', ndvi: 0.5 },
      ])
    );
    const res = await fetchNDVITimeSeries(-1.28, 36.81, 14);
    expect(res.data).toEqual([{ date: '2026-08-03', ndvi: 0.5 }]);
  });
});
