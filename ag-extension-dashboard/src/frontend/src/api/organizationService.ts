import apiClient from './client';

export interface OrganizationConfig {
  id: string;
  name: string;
  region: string | null;
  default_currency: string;
  default_language: string;
  capabilities: Record<string, boolean | string | number>;
  updated_at: string;
}

export interface OrganizationResponse {
  success: boolean;
  data: OrganizationConfig;
}

export const fetchOrganizationConfig = async (): Promise<OrganizationResponse> => {
  const response = await apiClient.get<OrganizationResponse>('/organizations/config');
  return response.data;
};

export const updateOrganizationConfig = async (
  updates: Partial<{
    name: string;
    region: string;
    currency: string;
    language: string;
    capabilities: OrganizationConfig['capabilities'];
  }>
): Promise<OrganizationResponse> => {
  const response = await apiClient.patch<OrganizationResponse>('/organizations/config', updates);
  return response.data;
};
