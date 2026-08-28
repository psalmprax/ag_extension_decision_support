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
  return response.data.data;
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
