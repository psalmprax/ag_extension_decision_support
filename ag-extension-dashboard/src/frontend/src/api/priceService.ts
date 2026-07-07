import apiClient from './client';

export interface MarketPrice {
  id: string;
  crop: string;
  price: string;
  trend: string;
  updatedAt: string;
}

export const fetchMarketPrices = async (): Promise<MarketPrice[]> => {
  const response = await apiClient.get('/external/prices');
  return response.data.data;
};
