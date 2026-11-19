import { useQuery } from '@tanstack/react-query';
import { fetchPlanQuotas, type PlanQuotas } from '@/api/billingService';

/**
 * Subscription plans an admin can assign in the access modal. The demo session never
 * fetches them, so it never reports a load failure either.
 */
export function useAssignablePlans(enabled: boolean, isDemo: boolean, fallbackError: string) {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['plan-quotas'],
    queryFn: fetchPlanQuotas,
    enabled: enabled && !isDemo,
  });
  const plansLoadFailed =
    !isDemo && !isLoading && (isError || (data !== undefined && data.success === false));
  const plans: PlanQuotas[] = data?.success === true && Array.isArray(data.data) ? data.data : [];
  return {
    plans,
    isLoadingPlans: isLoading,
    isFetchingPlans: isFetching,
    plansLoadFailed,
    plansErrorMessage: data?.error || fallbackError,
    refetchPlans: refetch,
  };
}
