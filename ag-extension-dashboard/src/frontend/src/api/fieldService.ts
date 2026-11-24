import apiClient from './client';
import type { CreateField, CropCycle as SharedCropCycle, Field as SharedField, UpdateField } from '@ag-extension/shared/api';
import { isNetworkFailure, sendOrQueue, type QueuedWrite } from './offlineWrites';
import { withPendingFieldWrites } from './pendingFieldWrites';
import { newRecordId } from '@/lib/randomId';
import { recallRead, rememberRead } from '@/lib/offlineReadCache';

// Canonical shapes come from the shared API contract (@ag-extension/shared/api). Records saved on
// this device that have not reached the server yet carry pendingSync.
export type CropCycle = SharedCropCycle & { pendingSync?: boolean };
export type Field = Omit<SharedField, 'cropCycles'> & { cropCycles?: CropCycle[]; pendingSync?: boolean };

export interface FieldList {
  success: boolean;
  data: Field[];
  /** True when there was no connection and these are the fields kept on this device. */
  offline?: boolean;
  error?: string;
}

/** The answer to a write: queued when it is waiting on this device for a connection. */
export interface SaveResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  queued?: boolean;
}

export type CropCycleWrite = Partial<Omit<SharedCropCycle, 'id' | 'fieldId' | 'createdAt' | 'updatedAt' | 'variety' | 'notes'>> & {
  variety?: string | null;
  notes?: string | null;
};

/** Sends a field write now, or keeps it on this device until the connection is back. */
async function save<T>(write: QueuedWrite, request: (headers: Record<string, string>) => Promise<{ data: SaveResult<T> }>): Promise<SaveResult<T>> {
  const outcome = await sendOrQueue(write, async key => (await request({ 'Idempotency-Key': key })).data);
  return outcome.queued ? { success: true, queued: true } : outcome.result;
}

/** The farmer's fields, or for a farmer their own; without a connection, the copy kept here. */
export const fetchFields = async (farmerId?: string): Promise<FieldList> => {
  const cacheKey = `fields:${farmerId ?? 'own'}`;
  try {
    const response = await apiClient.get<FieldList>(farmerId ? `/v1/fields?farmerId=${farmerId}` : '/v1/fields');
    const body = response.data;
    if (body.success) rememberRead(cacheKey, body.data ?? []);
    return { ...body, data: withPendingFieldWrites(body.data ?? [], farmerId) };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    const kept = recallRead<Field[]>(cacheKey);
    return { success: true, offline: true, data: withPendingFieldWrites(kept?.value ?? [], farmerId) };
  }
};

export const createField = (data: Omit<CreateField, 'id'>): Promise<SaveResult<Field>> => {
  const body = { ...data, id: newRecordId() };
  return save(
    { entity: 'field', action: 'create', method: 'POST', endpoint: '/v1/fields', data: body, label: `New field: ${data.name}` },
    headers => apiClient.post('/v1/fields', body, { headers })
  );
};

export const updateField = (id: string, data: UpdateField & { farmerId?: string }): Promise<SaveResult<Field>> =>
  save(
    { entity: 'field', action: 'update', method: 'PUT', endpoint: `/v1/fields/${id}`, data, label: `Field changes: ${data.name ?? ''}`.trim() },
    headers => apiClient.put(`/v1/fields/${id}`, data, { headers })
  );

export const deleteField = (id: string, name = ''): Promise<SaveResult<never>> =>
  save(
    { entity: 'field', action: 'delete', method: 'DELETE', endpoint: `/v1/fields/${id}`, label: `Delete field: ${name}`.trim() },
    headers => apiClient.delete(`/v1/fields/${id}`, { headers })
  );

export const createCropCycle = (fieldId: string, data: CropCycleWrite): Promise<SaveResult<CropCycle>> => {
  const body = { ...data, id: newRecordId() };
  return save(
    { entity: 'crop_cycle', action: 'create', method: 'POST', endpoint: `/v1/fields/${fieldId}/cycles`, data: body, label: `New crop cycle: ${data.cropName ?? ''}`.trim() },
    headers => apiClient.post(`/v1/fields/${fieldId}/cycles`, body, { headers })
  );
};

export const updateCropCycle = (fieldId: string, cycleId: string, data: CropCycleWrite): Promise<SaveResult<CropCycle>> =>
  save(
    { entity: 'crop_cycle', action: 'update', method: 'PATCH', endpoint: `/v1/fields/${fieldId}/cycles/${cycleId}`, data, label: 'Crop cycle changes' },
    headers => apiClient.patch(`/v1/fields/${fieldId}/cycles/${cycleId}`, data, { headers })
  );

export const deleteCropCycle = (fieldId: string, cycleId: string): Promise<SaveResult<never>> =>
  save(
    { entity: 'crop_cycle', action: 'delete', method: 'DELETE', endpoint: `/v1/fields/${fieldId}/cycles/${cycleId}`, label: 'Delete crop cycle' },
    headers => apiClient.delete(`/v1/fields/${fieldId}/cycles/${cycleId}`, { headers })
  );
