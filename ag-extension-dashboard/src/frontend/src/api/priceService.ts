import apiClient from './client';

export type MarketDataStatus = 'live' | 'estimated' | 'unavailable';

export interface MarketPrice {
  id: string;
  crop: string;
  price: string;
  priceValue?: number;
  trend: string;
  updatedAt: string;
  source: 'faostat_producer_prices' | 'giews_fpma' | 'usda_fas_psd' | 'baseline_estimate' | 'fewsnet' | 'wfp';
  dataStatus: MarketDataStatus;
  fetchedAt: string;
  exchangeRateSource: 'live' | 'fallback' | 'native';
  currency: string;
}

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export interface PriceHistorySeries {
  crop: string;
  currency: string;
  source: string;
  dataStatus: MarketDataStatus;
  series: PriceHistoryPoint[];
}

export interface MarketPricesResponse {
  success: boolean;
  data: MarketPrice[];
  metadata: {
    dataStatus: MarketDataStatus;
    source: string | null;
    fetchedAt: string | null;
    exchangeRateSource: string | null;
    country?: string | null;
    periodDate?: string | null;
    marketCount?: number | null;
  };
}

export const fetchMarketPrices = async (): Promise<MarketPrice[]> => {
  const response = await apiClient.get<MarketPricesResponse>('/external/prices');
  return response.data.data;
};

export const fetchMarketPricesWithMetadata = async (): Promise<MarketPricesResponse> => {
  const response = await apiClient.get<MarketPricesResponse>('/external/prices');
  return response.data;
};

export const fetchPriceHistory = async (days = 30): Promise<PriceHistorySeries[]> => {
  const response = await apiClient.get<{ success: boolean; data: PriceHistorySeries[] }>(
    '/external/prices/history',
    { params: { days } }
  );
  return response.data.data;
};

/**
 * Per-kg retail medians (FEWS NET, monthly) for a supported country (KE/NG).
 * Different unit from the per-bag producer rows — render in a separate
 * section, never the same axis. Unsupported countries return empty data.
 */
export const fetchRetailPrices = async (country?: string): Promise<MarketPricesResponse> => {
  const response = await apiClient.get<MarketPricesResponse>('/external/prices/retail', {
    params: country ? { country } : {},
  });
  return response.data;
};
