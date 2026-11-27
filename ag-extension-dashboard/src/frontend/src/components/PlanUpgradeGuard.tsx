import React from 'react';
import { Lock, Check } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { accessRequestHref, lacksPaidAccess, type PaidService } from '@/lib/planAccess';
import { useLanguage } from '@/lib/LanguageContext';
import { planGateCopy, type PlanGateCategory } from '@/lib/planGateCopy';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/ui/controlStyles';
import { ACCESS_CONTACT_EMAIL, BILLING_ENABLED } from '@ag-extension/shared/api';

interface PlanUpgradeGuardProps {
  /** Translated name of the locked feature. */
  featureName: string;
  featureDescription?: string;
  category?: PlanGateCategory;
  children?: React.ReactNode;
}

// The server-side service behind each category (a system-administrator grant unlocks it).
const SERVICE_FOR_CATEGORY: Partial<Record<NonNullable<PlanUpgradeGuardProps['category']>, PaidService>> = {
  chat: 'chat', visits: 'field_visits', analytics: 'analytics', worldmonitor: 'worldmonitor', workflows: 'email_workflows',
  reports: 'reports', fields: 'fields', knowledge: 'knowledge_ai',
};

export const PlanUpgradeGuard: React.FC<PlanUpgradeGuardProps> = ({
  featureName,
  featureDescription,
  category = 'sms',
  children,
}) => {
  const { t } = useLanguage();
  const { user, setActiveTab } = useAppStore();

  // Pro, Enterprise, admins and accounts granted this service see the feature; the rest see the upgrade card.
  const isFree = lacksPaidAccess(user, SERVICE_FOR_CATEGORY[category]);

  if (!isFree) {
    return <>{children}</>;
  }

  const details = planGateCopy(category, t);
  const CategoryIcon = details.icon;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-xl w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] p-6 sm:p-8">
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-theme-text-muted">
          <Lock className="w-4 h-4" aria-hidden="true" />
          {BILLING_ENABLED
            ? t('plan_gate_available_on', { defaultValue: 'Available on Pro and Enterprise' })
            : t('plan_gate_not_in_account', { defaultValue: 'Not included in your account yet' })}
        </p>

        <h2 className="mt-3 text-2xl font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <CategoryIcon className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          {featureName}
        </h2>
        <p className="mt-2 text-base text-slate-600 dark:text-theme-text-secondary">{featureDescription || details.description}</p>

        <ul className="mt-6 space-y-2.5">
          {details.benefits.map(benefit => (
            <li key={benefit} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-theme-text-primary">
              <Check className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {BILLING_ENABLED ? (
          <div className="mt-8 flex flex-col sm:flex-row gap-2">
            <button onClick={() => setActiveTab('billing')} className={PRIMARY_BUTTON}>
              {t('billing_matrix_upgrade_pro')}
            </button>
            <button onClick={() => setActiveTab('billing')} className={SECONDARY_BUTTON}>
              {t('ui_plan_upgrade_guard_view_full_cost_access_matrix')}
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            <a href={accessRequestHref(featureName)} className={`${PRIMARY_BUTTON} inline-flex`}>
              {t('plan_gate_ask_access', { defaultValue: 'Ask us for access' })}
            </a>
            <p className="text-sm text-slate-600 dark:text-theme-text-secondary">
              {t('plan_gate_ask_access_note', { defaultValue: 'Email {email}. We switch it on for your account.', email: ACCESS_CONTACT_EMAIL })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
