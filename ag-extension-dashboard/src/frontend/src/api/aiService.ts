import apiClient from './client';

export interface BoxUpdateData {
  summary: string;
  keyObservations: string[];
  recommendedActions: string[];
  cropHealthStatus: 'good' | 'fair' | 'poor' | 'diseased';
  pestIssues: string;
  followUpRequired: boolean;
  nextVisitDateHint: string;
}

export interface SynthesisResponse {
  success: boolean;
  data: BoxUpdateData;
}

export const synthesizeVisit = async (notes: string, farmerId?: string): Promise<SynthesisResponse> => {
  const response = await apiClient.post<SynthesisResponse>('/ai/synthesize-visit', { notes, farmerId });
  return response.data;
};
