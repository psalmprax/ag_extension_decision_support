import React from 'react';
import type { KnowledgeQuotaData } from '@/api/knowledgeService';
import { useLanguage } from '@/lib/LanguageContext';
import { BILLING_ENABLED } from '@ag-extension/shared/api';

/** Questions left today. Nothing is shown on unlimited plans. */
export const QuotaChip: React.FC<{ quota: KnowledgeQuotaData; onUpgrade: () => void }> = ({ quota, onUpgrade }) => {
  const { t } = useLanguage();
  if (quota.limit === -1) return null;

  return (
    <p className="text-sm text-slate-600 dark:text-white/70 tabular-nums">
      {t('kb_quota_left_today', {
        remaining: quota.remaining,
        limit: quota.limit,
        defaultValue: '{remaining} of {limit} questions left today',
      })}
      {BILLING_ENABLED && quota.isFree && quota.remaining <= 1 && (
        <button
          type="button"
          onClick={onUpgrade}
          className="ms-2 underline underline-offset-2 text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
        >
          {t('kb_quota_upgrade', { defaultValue: 'Upgrade' })}
        </button>
      )}
    </p>
  );
};
