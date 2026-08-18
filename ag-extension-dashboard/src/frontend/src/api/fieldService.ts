import apiClient from './client';
import type { Field, CropCycle } from '@ag-extension/shared/api';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api).
export type { Field, CropCycle };

export const fetchFields = async (farmerId?: string) => {
  const url = farmerId ? `/fields?farmerId=${farmerId}` : '/fields';
  const response = await apiClient.get(`/v1${url}`);
  return response.data;
};

export const createField = async (data: Partial<Field>) => {
  const response = await apiClient.post('/v1/fields', data);
  return response.data;
};

export const updateField = async (id: string, data: Partial<Field>) => {
  const response = await apiClient.put(`/v1/fields/${id}`, data);
  return response.data;
};

export const deleteField = async (id: string) => {
  const response = await apiClient.delete(`/v1/fields/${id}`);
  return response.data;
};

export const createCropCycle = async (fieldId: string, data: Partial<CropCycle>) => {
  const response = await apiClient.post(`/v1/fields/${fieldId}/cycles`, data);
  return response.data;
};

export const updateCropCycle = async (
  fieldId: string,
  cycleId: string,
  data: Partial<CropCycle>
) => {
  const response = await apiClient.patch(`/v1/fields/${fieldId}/cycles/${cycleId}`, data);
  return response.data;
};

export const deleteCropCycle = async (fieldId: string, cycleId: string) => {
  const response = await apiClient.delete(`/v1/fields/${fieldId}/cycles/${cycleId}`);
  return response.data;
};
