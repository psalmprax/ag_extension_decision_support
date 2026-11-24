import apiClient from './client';

export type ReviewStatus = 'pending' | 'approved' | 'dismissed' | 'escalated';

/** Why the item was queued (null for manual submissions made before triggers existed). */
export type ReviewTrigger = 'safety_boundary' | 'invalid_references' | 'no_sources' | 'farmer_request' | 'officer_edit';

export interface RecommendationReview {
  id: string;
  farmer_id: string;
  report_id: string | null;
  recommendation: string;
  confidence: number | null;
  evidence_status: 'verified_source' | 'no_verified_source';
  trigger?: ReviewTrigger | null;
  status: ReviewStatus;
  disposition?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  /** The knowledge-base document made from this advice, once added. */
  knowledge_article_id?: string | null;
}

/** Approved advice, as the reviewer wants it in the knowledge base. */
export interface ReviewedAdviceDocument {
  title: string;
  content: string;
  crops: string[];
  sources?: string;
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

/** Adds approved advice to the knowledge base; it waits there for a manager's approval. */
export const addReviewedAdviceToKnowledge = async (
  id: string,
  document: ReviewedAdviceDocument
): Promise<{ success: boolean; data: { knowledgeArticleId: string; pendingReview: boolean } }> => {
  const response = await apiClient.post(`/ai/reviews/${id}/knowledge-article`, document);
  return response.data;
};
