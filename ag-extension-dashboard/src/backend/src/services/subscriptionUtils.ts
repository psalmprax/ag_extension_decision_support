/**
 * Shared subscription utilities — extracted to break circular dependency
 * between paymentService and usageService.
 */

/**
 * Determines if a subscription grants a paid entitlement.
 * A subscription is active if:
 * - status is 'active' or 'trialing' (trialing counts as active; its period end is the trial end)
 * - currentPeriodEnd is defined and in the future
 * 'past_due' does NOT count as active — a failed payment must not keep granting a paid entitlement.
 */
export function isSubscriptionActive(
    sub: { status?: string | null; currentPeriodEnd?: Date | string | null } | null | undefined
): boolean {
    if (!sub) return false;
    if (sub.status !== 'active' && sub.status !== 'trialing') return false;
    if (sub.currentPeriodEnd === undefined || sub.currentPeriodEnd === null) return false;
    return new Date(sub.currentPeriodEnd).getTime() > Date.now();
}
