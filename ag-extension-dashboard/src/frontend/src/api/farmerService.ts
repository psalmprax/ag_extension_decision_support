import apiClient from './client';
import { fetchAllPages } from './fetchAllPages';
import type { Farmer, FarmerListResponse } from '@ag-extension/shared/api';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api).
export type { Farmer };
export type FarmersResponse = FarmerListResponse;

/**
 * Every farmer this person may see, page by page (500 per request, the server's ceiling).
 * One request returned only the first 50, so an officer with more could not find the rest.
 */
export const fetchFarmers = (): Promise<FarmerListResponse> =>
  fetchAllPages('/farmers', 'farmers', { pageSize: 500, ceiling: 10_000 }) as Promise<FarmerListResponse>;

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
  /** The extension officer assigned to the farmer, or null when none is. */
  officerName?: string | null;
  /** Where the farm is, when recorded; null until the farmer or officer adds it. */
  location?: { lat: number; lng: number } | null;
  country?: string | null;
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

interface BulkDeleteResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
}

/**
 * There is no single-farmer DELETE route; the bulk endpoint applies the same
 * access rules. It answers 200 for partial failure, so the outcome is read from
 * its counts rather than the envelope.
 */
export const deleteFarmer = async (id: string): Promise<{ success: boolean; error?: string }> => {
  const response = await apiClient.post<{ success: boolean; data?: BulkDeleteResult }>('/farmers/bulk/delete', { ids: [id] });
  const result = response.data.data;
  if (result && result.processed === 1 && result.failed === 0) return { success: true };
  return { success: false, error: result?.errors?.[0]?.replace(/^Failed to delete farmer \S+: /, '') || 'The farmer could not be deleted.' };
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
