import apiClient from './client';

export type AgriDataStatus = 'live' | 'estimated' | 'unavailable';

export interface NDVIPoint {
  date: string;
  ndvi: number;
}

export interface NDVITimeSeriesResult {
  data: NDVIPoint[];
  source: 'nasa-power-agroclimate-proxy' | 'satellite-history';
  dataStatus: AgriDataStatus;
  reason: string;
}

/** Raw point shape as returned by /external/ndvi-timeseries. */
interface RawNDVIPoint {
  date: string;
  ndvi?: number;
  vigor?: number;
}

/**
 * Normalize backend vigor-proxy points to the NDVIPoint contract.
 * The endpoint returns `{ date, vigor }`; older/alternate payloads may carry
 * `ndvi` directly. Points with neither (or non-finite values) are dropped so
 * charts never render NaN bars.
 */
function normalizeNdviPoints(raw: RawNDVIPoint[]): NDVIPoint[] {
  return raw
    .map(p => {
      const value = typeof p.ndvi === 'number' ? p.ndvi : p.vigor;
      return { date: p.date, ndvi: typeof value === 'number' ? value : Number.NaN };
    })
    .filter(p => typeof p.date === 'string' && Number.isFinite(p.ndvi));
}

export interface CommodityMetrics {
  production: number | null;
  yield: number | null;
  area: number | null;
  imports: number | null;
  exports: number | null;
  unit: string;
}

export interface UsdaBenchmarkResult {
  country: { records: unknown[]; metrics: CommodityMetrics } | null;
  world: { records: unknown[]; metrics: CommodityMetrics } | null;
  dataStatus: AgriDataStatus;
}

export const fetchNDVITimeSeries = async (
  lat: number,
  lng: number,
  days = 90
): Promise<NDVITimeSeriesResult> => {
  const response = await apiClient.get<{ success: boolean; data: NDVITimeSeriesResult }>(
    '/external/ndvi-timeseries',
    { params: { lat, lng, days } }
  );
  const payload = response.data.data;
  return { ...payload, data: normalizeNdviPoints((payload.data ?? []) as RawNDVIPoint[]) };
};

export const fetchUsdaBenchmark = async (
  crop: string,
  country = 'Kenya'
): Promise<UsdaBenchmarkResult> => {
  const response = await apiClient.get<{ success: boolean; data: UsdaBenchmarkResult }>(
    `/external/usda/${encodeURIComponent(crop)}`,
    { params: { country } }
  );
  return response.data.data;
};
