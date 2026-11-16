import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

/**
 * Why an AI recommendation was queued for human agronomic review.
 *   - safety_boundary:    the safety guard rewrote or flagged the advice
 *   - invalid_references: the answer cited sources it was not given
 *   - no_sources:         nothing was retrieved, so the answer is the model's own
 *   - farmer_request:     the farmer asked for a human to check it
 */
export type ReviewTrigger = 'safety_boundary' | 'invalid_references' | 'no_sources' | 'farmer_request';

export const REVIEW_TRIGGERS: readonly ReviewTrigger[] = ['safety_boundary', 'invalid_references', 'no_sources', 'farmer_request'];

export interface AdvisoryEvidenceSummary {
    status: string;
    invalidReferences: boolean;
}

/**
 * Which AI answers a human agronomist should check, most serious reason first.
 * Answers grounded in retrieved sources with valid citations are not queued:
 * the queue is for advice nobody has evidence for, so it stays reviewable.
 */
export function reviewTriggerFor(evidence: AdvisoryEvidenceSummary, safetyViolations: number): ReviewTrigger | null {
    if (safetyViolations > 0) return 'safety_boundary';
    if (evidence.invalidReferences) return 'invalid_references';
    if (evidence.status === 'general_guidance_only') return 'no_sources';
    return null;
}

/**
 * Queue an AI answer given in a farmer's conversation for review. Only
 * conversations linked to a farmer are queued (the review is about advice to
 * that farmer). Never throws: the farmer's answer must not depend on the queue.
 * Returns the review id, or null when nothing was queued.
 */
export async function enqueueAdvisoryReview(params: {
    conversationId: string;
    createdBy: string;
    recommendation: string;
    trigger: ReviewTrigger;
}): Promise<string | null> {
    try {
        const result = await query<{ id: string }>(
            `INSERT INTO recommendation_reviews
               (tenant_id, farmer_id, created_by, recommendation, evidence_status, trigger)
             SELECT f.tenant_id, cv.farmer_id, $2, $3, 'no_verified_source', $4
             FROM chat_conversations cv
             JOIN farmers f ON f.id = cv.farmer_id
             WHERE cv.id = $1
             RETURNING id`,
            [params.conversationId, params.createdBy, params.recommendation.slice(0, 10000), params.trigger],
        );
        const id = result.rows[0]?.id ?? null;
        if (id) logger.info(`Queued AI recommendation ${id} for agronomic review (${params.trigger})`);
        return id;
    } catch (error) {
        logger.warn('Could not queue AI recommendation for review:', error);
        return null;
    }
}
