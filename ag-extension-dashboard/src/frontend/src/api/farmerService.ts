import apiClient from './client';
import type { Farmer, FarmerListResponse } from '@ag-extension/shared/api';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api).
export type { Farmer };
export type FarmersResponse = FarmerListResponse;

export const fetchFarmers = async (): Promise<FarmerListResponse> => {
  const response = await apiClient.get<FarmerListResponse>('/farmers');
  return response.data;
};

export const createFarmer = async (
  farmer: Partial<Farmer>
): Promise<{ success: boolean; data: Farmer }> => {
  const response = await apiClient.post<{ success: boolean; data: Farmer }>('/farmers', farmer);
  return response.data;
};

export interface FarmerStats {
  crops: string[];
  farmSize: number;
  vitalScore: number;
  yieldHistory: Array<{ month: string; yield: number }>;
  soilMoisture: string;
  avgTemp: string;
  phLevel: string;
  aiConfidence: string;
  nextVisitDate?: string;
  aiTipsCount?: number;
  alertsCount?: number;
}

export interface FarmerStatsResponse {
  success: boolean;
  data: FarmerStats | null;
  meta?: {
    state?: 'no_profile' | 'available';
  };
}

export const fetchFarmerStats = async (): Promise<FarmerStatsResponse> => {
  const response = await apiClient.get<FarmerStatsResponse>('/analytics/farmer-stats');
  return response.data;
};

export const updateFarmer = async (
  id: string,
  updates: Partial<Farmer>
): Promise<{ success: boolean; data: Farmer }> => {
  const response = await apiClient.patch<{ success: boolean; data: Farmer }>(
    `/farmers/${id}`,
    updates
  );
  return response.data;
};

export const deleteFarmer = async (id: string): Promise<{ success: boolean }> => {
  const response = await apiClient.delete<{ success: boolean }>(`/farmers/${id}`);
  return response.data;
};

export const deleteFarmers = async (ids: string[]): Promise<{ success: boolean }> => {
  const response = await apiClient.post<{ success: boolean }>('/farmers/bulk/delete', { ids });
  return response.data;
};

export const updateFarmers = async (
  ids: string[],
  updates: Partial<Farmer>
): Promise<{ success: boolean }> => {
  const response = await apiClient.post<{ success: boolean }>('/farmers/bulk/update', {
    ids,
    updates,
  });
  return response.data;
};

export const fetchFarmerById = async (id: string): Promise<{ success: boolean; data: Farmer }> => {
  const response = await apiClient.get<{ success: boolean; data: Farmer }>(`/farmers/${id}`);
  return response.data;
};
