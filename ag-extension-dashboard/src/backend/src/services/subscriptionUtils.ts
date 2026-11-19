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

export interface PlanEntitlementInput {
    role?: string | null;
    isDemo?: boolean | null;
    email?: string | null;
    planName?: string | null;
    planPrice?: string | number | null;
    subscriptionStatus?: string | null;
    subscriptionPeriodEnd?: Date | string | null;
}

/**
 * Resolves effective plan display name and whether the user is restricted to
 * the Free tier across auth responses, /me, and user directory listings.
 */
export function resolveUserPlan(input: PlanEntitlementInput): { planName: string; isFree: boolean } {
    if (input.role === 'admin') {
        return { planName: 'Admin', isFree: false };
    }
    if (input.isDemo || input.email === 'demo@agridemo.com') {
        return { planName: 'Free', isFree: true };
    }
    if (
        input.planName &&
        isSubscriptionActive({
            status: input.subscriptionStatus,
            currentPeriodEnd: input.subscriptionPeriodEnd,
        })
    ) {
        const price = input.planPrice != null ? Number(input.planPrice) : 0;
        const normalizedName = input.planName.trim();
        const isFree = price === 0 || normalizedName.toLowerCase().includes('free');
        return { planName: normalizedName, isFree };
    }
    return { planName: 'Free', isFree: true };
}

/**
 * Computes the next billing period end for an admin-assigned or activated
 * subscription from its plan billing interval.
 */
export function computeSubscriptionPeriodEnd(interval?: string | null, from: Date = new Date()): Date {
    const end = new Date(from.getTime());
    const normalized = (interval || 'month').trim().toLowerCase();
    if (normalized === 'year' || normalized === 'annual' || normalized === 'yearly') {
        end.setUTCFullYear(end.getUTCFullYear() + 1);
    } else {
        end.setUTCMonth(end.getUTCMonth() + 1);
    }
    return end;
}
