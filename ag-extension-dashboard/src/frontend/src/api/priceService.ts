import apiClient from './client';

export type MarketDataStatus = 'live' | 'estimated' | 'unavailable';

export interface MarketPrice {
  id: string;
  crop: string;
  price: string;
  trend: string;
  updatedAt: string;
  source: 'faostat_producer_prices' | 'giews_fpma' | 'usda_fas_psd' | 'baseline_estimate';
  dataStatus: MarketDataStatus;
  fetchedAt: string;
  exchangeRateSource: 'live' | 'fallback';
  currency: string;
}

export interface MarketPricesResponse {
  success: boolean;
  data: MarketPrice[];
  metadata: {
    dataStatus: MarketDataStatus;
    source: string | null;
    fetchedAt: string | null;
    exchangeRateSource: string | null;
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
