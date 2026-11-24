import apiClient from './client';

export type AgriDataStatus = 'live' | 'estimated' | 'unavailable';

/** One day of NASA POWER weather at a point: rain in mm and mean air temperature in °C. */
export interface WeatherDay {
  date: string;
  rainMm: number;
  tempC: number;
}

/** Measured weather, not a measure of the crop. */
export interface RecentWeatherResult {
  data: WeatherDay[];
  source: 'nasa-power';
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

export const fetchRecentWeather = async (lat: number, lng: number, days = 14): Promise<RecentWeatherResult> => {
  const response = await apiClient.get<{ success: boolean; data: RecentWeatherResult }>('/external/recent-weather', {
    params: { lat, lng, days },
  });
  const payload = response.data.data;
  const data = (payload.data ?? []).filter(
    day => typeof day.date === 'string' && Number.isFinite(day.rainMm) && Number.isFinite(day.tempC),
  );
  return { ...payload, data };
};

export const fetchUsdaBenchmark = async (
  crop: string,
  country?: string
): Promise<UsdaBenchmarkResult> => {
  const response = await apiClient.get<{ success: boolean; data: UsdaBenchmarkResult }>(
    `/external/usda/${encodeURIComponent(crop)}`,
    { params: country ? { country } : {} }
  );
  return response.data.data;
};
