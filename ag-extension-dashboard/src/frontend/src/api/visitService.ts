import apiClient from './client';
import { syncQueue } from './syncQueueService';

export interface Visit {
  id: string;
  farmer_id: string;
  farmer_name: string;
  visit_type: string;
  status: string;
  scheduled_at: string;
  notes?: string;
  outcomes?: string;
}

export interface VisitsResponse {
  success: boolean;
  data: {
    visits: Visit[];
    total: number;
  };
}

export const fetchVisits = async (): Promise<VisitsResponse> => {
  const response = await apiClient.get<VisitsResponse>('/visits');
  return response.data;
};

export const fetchVisitsByFarmer = async (farmerId: string): Promise<VisitsResponse> => {
  const response = await apiClient.get<VisitsResponse>(`/visits?farmerId=${farmerId}`);
  return response.data;
};

export const fetchSynthesis = async (
  farmerId: string,
  notes: string
): Promise<{ success: boolean; data: { summary: string } }> => {
  const response = await apiClient.post('/chatbot/synthesis', { farmerId, notes });
  return response.data;
};

type VisitMutationResponse = { success: boolean; data: Visit; queued?: boolean };

function createMutationKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `visit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isNetworkFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && !('response' in error);
}

function queueVisitMutation(
  action: 'create' | 'update',
  endpoint: string,
  data: Partial<Visit>,
  idempotencyKey: string
): VisitMutationResponse {
  syncQueue.enqueue({
    action,
    entity: 'visit',
    endpoint,
    method: action === 'create' ? 'POST' : 'PATCH',
    data: data as Record<string, unknown>,
    idempotencyKey,
  });

  return {
    success: true,
    queued: true,
    data: {
      ...data,
      id: idempotencyKey,
      status: action === 'create' ? 'scheduled' : data.status || 'scheduled',
    } as Visit,
  };
}

export const createVisit = async (data: Partial<Visit>): Promise<VisitMutationResponse> => {
  const idempotencyKey = createMutationKey();
  if (!navigator.onLine) {
    return queueVisitMutation('create', '/visits', data, idempotencyKey);
  }

  try {
    const response = await apiClient.post<{ success: boolean; data: Visit }>('/visits', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return response.data;
  } catch (error: unknown) {
    if (!isNetworkFailure(error)) throw error;
    return queueVisitMutation('create', '/visits', data, idempotencyKey);
  }
};

export const updateVisit = async (id: string, data: Partial<Visit>): Promise<VisitMutationResponse> => {
  const idempotencyKey = createMutationKey();
  const endpoint = `/visits/${id}`;
  if (!navigator.onLine) {
    return queueVisitMutation('update', endpoint, { ...data, id }, idempotencyKey);
  }

  try {
    const response = await apiClient.patch<{ success: boolean; data: Visit }>(endpoint, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return response.data;
  } catch (error: unknown) {
    if (!isNetworkFailure(error)) throw error;
    return queueVisitMutation('update', endpoint, { ...data, id }, idempotencyKey);
  }
};

export interface PriorityData {
  farmerId: string;
  score: number;
  level: string;
  factors: {
    diseaseAlerts: number;
    weatherRisk: number;
    visitRecency: number;
    vitalScore: number;
  };
  reasons: string[];
  recommendedAction: string;
}

export const fetchPriorityScore = async (
  farmerId: string
): Promise<{ success: boolean; data: PriorityData }> => {
  const response = await apiClient.get<{ success: boolean; data: PriorityData }>(
    `/external/priority/${farmerId}`
  );
  return response.data;
};

export interface SatelliteIndex {
  ndvi: number;
  color: string;
  health: string;
  timestamp: string;
  source: 'sentinel-hub' | 'nasa-gibs';
  dataStatus: 'live';
  cloudCover: number | null;
  resolution: string;
}

export const fetchSatelliteTelemetry = async (
  lat: number,
  lng: number,
  farmerId?: string
): Promise<{ success: boolean; data: SatelliteIndex[] }> => {
  const response = await apiClient.get<{ success: boolean; data: SatelliteIndex[] }>(
    `/external/satellite`,
    {
      params: { lat, lng, farmerId },
    }
  );
  return response.data;
};
