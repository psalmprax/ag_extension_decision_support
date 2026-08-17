import apiClient from './client';

export type ReviewStatus = 'pending' | 'approved' | 'dismissed' | 'escalated';

export interface RecommendationReview {
  id: string;
  farmer_id: string;
  report_id: string | null;
  recommendation: string;
  confidence: number | null;
  evidence_status: 'verified_source' | 'no_verified_source';
  status: ReviewStatus;
  disposition?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export const fetchRecommendationReviews = async (
  status: ReviewStatus = 'pending'
): Promise<{ success: boolean; data: RecommendationReview[] }> => {
  const response = await apiClient.get('/ai/reviews', { params: { status } });
  return response.data;
};

export const updateRecommendationReview = async (
  id: string,
  status: Exclude<ReviewStatus, 'pending'>,
  disposition: string
): Promise<{ success: boolean; data: RecommendationReview }> => {
  const response = await apiClient.patch(`/ai/reviews/${id}`, { status, disposition });
  return response.data;
};
