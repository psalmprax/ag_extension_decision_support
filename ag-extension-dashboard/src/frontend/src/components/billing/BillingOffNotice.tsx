import React from 'react';
import { CreditCard } from 'lucide-react';
import { ACCESS_CONTACT_EMAIL } from '@ag-extension/shared/api';
import { useLanguage } from '@/lib/LanguageContext';

/** Shown instead of Billing while payments are switched off (shared billingSwitch). */
export const BillingOffNotice: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-xl w-full rounded-lg bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] p-6 sm:p-8">
        <h2 className="text-2xl font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          {t('billing_off_title', { defaultValue: 'Billing is not open yet' })}
        </h2>
        <p className="mt-2 text-base text-slate-600 dark:text-theme-text-secondary">
          {t('billing_off_body', {
            defaultValue: 'There is nothing to pay at the moment. To use a feature that is not in your account yet, email {email} and we switch it on.',
            email: ACCESS_CONTACT_EMAIL,
          })}
        </p>
      </div>
    </div>
  );
};
