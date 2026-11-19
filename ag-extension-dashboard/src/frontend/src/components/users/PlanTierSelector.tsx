import { RefreshCw } from 'lucide-react';
import type { PlanQuotas } from '@/api/billingService';
import { useLanguage } from '@/lib/LanguageContext';

interface PlanTierSelectorProps {
  /** Manual plan changes are the system administrator's alone (the server enforces it too). */
  canChangePlan: boolean;
  planId: string;
  currentPlanName?: string | null;
  role: string;
  isDemo: boolean;
  isLoadingPlans: boolean;
  isFetchingPlans: boolean;
  plansLoadFailed: boolean;
  plansErrorMessage: string;
  plans: PlanQuotas[];
  onChangePlanId: (planId: string) => void;
  onRetry: () => void;
}

export function PlanTierSelector({
  canChangePlan,
  planId,
  currentPlanName,
  role,
  isDemo,
  isLoadingPlans,
  isFetchingPlans,
  plansLoadFailed,
  plansErrorMessage,
  plans,
  onChangePlanId,
  onRetry,
}: PlanTierSelectorProps) {
  const { t } = useLanguage();
  const isAdminRole = role === 'admin';

  if (!canChangePlan) {
    return (
      <p className="text-[11px] text-white/50">
        {t(
          'users_access_plan_system_admin_note',
          'Only the system administrator can change a subscription plan manually.'
        )}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="access-plan-select" className="text-xs font-medium text-white/70">
        {t('users_access_plan_label', 'Subscription Tier (Feature Access)')}
      </label>
      <select
        id="access-plan-select"
        value={planId}
        disabled={isLoadingPlans || isAdminRole || plansLoadFailed}
        onChange={e => onChangePlanId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-slate-900 text-white text-xs outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-60"
      >
        <option value="">
          {isAdminRole
            ? t('users_access_admin_full', 'Admin — Full Platform Access')
            : t('users_access_keep_plan', 'Current: {plan} (unchanged)', {
                plan: currentPlanName || 'Free',
              })}
        </option>
        {plans.map(plan => (
          <option key={plan.id} value={plan.id}>
            {plan.name} ({plan.currency} {plan.price}/{plan.interval})
          </option>
        ))}
      </select>

      {plansLoadFailed && !isAdminRole && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
          <span>{plansErrorMessage}</span>
          <button
            type="button"
            disabled={isFetchingPlans}
            onClick={onRetry}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-medium shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isFetchingPlans ? 'animate-spin' : ''}`} />
            <span>{t('users_access_plans_retry', 'Retry')}</span>
          </button>
        </div>
      )}

      {!plansLoadFailed && !isLoadingPlans && !isDemo && !isAdminRole && plans.length === 0 && (
        <p className="text-[11px] text-white/50">
          {t('users_access_no_plans', 'No active subscription plans available.')}
        </p>
      )}

      <p className="text-[11px] text-white/50">
        {isAdminRole
          ? t(
              'users_access_admin_bypass_note',
              'Admin accounts bypass subscription tier restrictions automatically.'
            )
          : t(
              'users_access_plan_hint',
              'Pro & Enterprise unlock AI Chat, Visits, Spatial Intelligence, SMS, Diagnostics, and Analytics.'
            )}
      </p>
    </div>
  );
}
