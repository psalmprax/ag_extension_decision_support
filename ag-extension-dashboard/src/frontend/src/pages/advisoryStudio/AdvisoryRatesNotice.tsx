import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/** Shown in the studio: template rates are editable examples, not recommendations. */
export function AdvisoryRatesNotice() {
  const { t } = useLanguage();
  return (
    <div role="note" className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-xs text-amber-200">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t('ui_advisory_rates_notice_rates_and_thresholds_in_templates_ar')}</span>
    </div>
  );
}
