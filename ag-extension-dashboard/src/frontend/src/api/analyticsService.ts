import apiClient from './client';

/** Support KPIs over the last 30 days. null means nothing was measured yet. */
export interface PerformanceMetrics {
  /** Minutes from a conversation's start to its first reply. */
  avgResponseTime: number | null;
  resolutionRate: number | null;
  /** Mean farmer rating, 1–5. */
  satisfactionScore: number | null;
  /** Share of completed visits that needed a follow-up. */
  followUpRate: number | null;
  /** Share of conversations resolved after the farmer's first message. */
  firstContactResolution: number | null;
  samples?: { conversations: number; replied: number; ratings: number; completedVisits: number };
}

export interface PerformanceData {
  metrics?: Partial<PerformanceMetrics>;
  timeline?: Array<Record<string, string | number>>;
  byOfficer?: Array<Record<string, string | number>>;
}

export interface PerformanceResponse {
  success: boolean;
  data: Required<Pick<PerformanceData, 'timeline' | 'byOfficer'>> & { metrics: PerformanceMetrics };
}

export const fetchPerformanceData = async (): Promise<PerformanceResponse> => {
  const response = await apiClient.get<PerformanceResponse>('/analytics/performance');
  return response.data;
};
