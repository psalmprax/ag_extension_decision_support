const PERCENTAGE_MULTIPLIER = 100;

const toCount = (value: unknown): number => parseInt(String(value ?? '0'), 10) || 0;
const oneDecimal = (value: number): number => Math.round(value * 10) / 10;
/** A share of `total` as a whole percentage, or null when nothing was counted. */
const percentOf = (part: number, total: number): number | null =>
    total > 0 ? Math.round((part / total) * PERCENTAGE_MULTIPLIER) : null;

/**
 * Support KPIs. Each value is null when there is nothing to measure yet, so the
 * dashboard can say "no data" instead of showing a misleading 0; `samples`
 * says how many records each figure rests on.
 */
export function formatPerformanceMetrics(results: Record<string, unknown>[][]) {
    const [replyResult, resolutionResult, satisfactionResult, followUpResult, fcrResult] = results;
    const replied = toCount(replyResult[0]?.replied);
    const conversations = toCount(resolutionResult[0]?.total);
    const ratings = toCount(satisfactionResult[0]?.rated);
    const completedVisits = toCount(followUpResult[0]?.completed);

    return {
        /** Minutes from a conversation's start to its first reply (AI or officer). */
        avgResponseTime: replied > 0 ? oneDecimal(parseFloat(String(replyResult[0]?.avg_minutes))) : null,
        resolutionRate: percentOf(toCount(resolutionResult[0]?.resolved), conversations),
        /** Mean farmer rating on the 1–5 scale. */
        satisfactionScore: ratings > 0 ? oneDecimal(parseFloat(String(satisfactionResult[0]?.avg))) : null,
        /** Completed visits that needed a follow-up. */
        followUpRate: percentOf(toCount(followUpResult[0]?.follow_ups), completedVisits),
        /** Conversations resolved after the farmer's first message. */
        firstContactResolution: percentOf(toCount(fcrResult[0]?.first_contact), toCount(fcrResult[0]?.total)),
        samples: { conversations, replied, ratings, completedVisits },
    };
}

export type PerformanceMetrics = ReturnType<typeof formatPerformanceMetrics>;
