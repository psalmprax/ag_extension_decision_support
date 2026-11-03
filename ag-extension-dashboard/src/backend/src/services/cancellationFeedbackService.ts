import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';

/**
 * Controlled vocabulary for why a subscriber cancelled. Stored verbatim in
 * cancellation_feedback.reason and grouped for churn reporting, so adding a value
 * here is the only way to introduce a new bucket.
 */
export const CANCELLATION_REASONS = [
    'too_expensive',
    'not_using_enough',
    'missing_features',
    'switching_service',
    'poor_support',
    'seasonal_pause',
    'other',
] as const;

export type CancellationReason = typeof CANCELLATION_REASONS[number];

export const MAX_CANCELLATION_COMMENT_LENGTH = 1000;

export function isCancellationReason(value: unknown): value is CancellationReason {
    return typeof value === 'string' && (CANCELLATION_REASONS as readonly string[]).includes(value);
}

class CancellationFeedbackService {
    /**
     * Stores the reason for one subscription. Re-cancelling the same subscription
     * updates its existing row instead of counting the customer twice.
     */
    async record(params: {
        subscriptionId: string;
        userId: string;
        reason: CancellationReason;
        comment?: string | null;
    }): Promise<boolean> {
        const comment = params.comment?.trim()
            ? params.comment.trim().slice(0, MAX_CANCELLATION_COMMENT_LENGTH)
            : null;

        try {
            await getPrisma().cancellationFeedback.upsert({
                where: { subscriptionId: params.subscriptionId },
                create: {
                    subscriptionId: params.subscriptionId,
                    userId: params.userId,
                    reason: params.reason,
                    comment,
                },
                update: { reason: params.reason, comment },
            });
            return true;
        } catch (error) {
            logger.error('Failed to record cancellation feedback:', error);
            return false;
        }
    }
}

export const cancellationFeedbackService = new CancellationFeedbackService();
