import { User } from '@/store/useAppStore';

export type PromptVariant = 'info' | 'tip' | 'guidance' | 'neutral';
export type PromptPlacement = 'top' | 'bottom' | 'left' | 'right';
export type PromptTrigger = 'hover' | 'click' | 'both';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SubscriptionState {
  tier: SubscriptionTier;
  planName: string;
  isProOrHigher: boolean;
  isEnterprise: boolean;
  isActive: boolean;
}

/**
 * Resolves current user subscription tier and entitlement.
 */
export function resolveSubscriptionState(
  user: User | null,
  subscription: { plan?: { name?: string; status?: string } } | null,
  isDemo: boolean
): SubscriptionState {
  if (isDemo || user?.role === 'admin') {
    return {
      tier: 'enterprise',
      planName: user?.role === 'admin' ? 'Admin Access' : 'Demo Mode (Pro)',
      isProOrHigher: true,
      isEnterprise: true,
      isActive: true,
    };
  }

  const planStr = (subscription?.plan?.name || user?.planName || '').toLowerCase();
  const isFree = user?.isFree || planStr === 'free' || !planStr;

  let tier: SubscriptionTier = 'free';
  if (planStr.includes('enterprise') || planStr.includes('coop')) {
    tier = 'enterprise';
  } else if (planStr.includes('pro') || (!isFree && planStr)) {
    tier = 'pro';
  }

  return {
    tier,
    planName: subscription?.plan?.name || user?.planName || (tier === 'free' ? 'Free Starter' : 'Pro Plan'),
    isProOrHigher: tier === 'pro' || tier === 'enterprise',
    isEnterprise: tier === 'enterprise',
    isActive: subscription?.plan?.status === 'active' || subscription?.plan?.status === 'trialing' || !isFree,
  };
}

/**
 * Check if the active subscription tier satisfies the required plan.
 */
export function checkTierMet(
  requiredPlan: SubscriptionTier | undefined,
  subState: SubscriptionState
): boolean {
  if (!requiredPlan) return true;
  if (requiredPlan === 'pro') return subState.isProOrHigher;
  return subState.isEnterprise;
}
