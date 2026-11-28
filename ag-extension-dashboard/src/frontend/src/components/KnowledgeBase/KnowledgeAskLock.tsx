import React from 'react';
import { Lock } from 'lucide-react';
import { BILLING_ENABLED } from '@ag-extension/shared/api';
import { accessRequestHref } from '@/lib/planAccess';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';

/**
 * Shown in place of the question box when AI answers are not in the account (the demo
 * and Free accounts). The document library, graph and illustrations stay open.
 */
export const KnowledgeAskLock: React.FC = () => {
  const { t } = useLanguage();
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const feature = t('plan_gate_name_knowledge', { defaultValue: 'Knowledge AI answers' });
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-base font-medium text-slate-900 dark:text-theme-text-primary">
        <Lock className="w-4 h-4 text-slate-500 dark:text-theme-text-muted" aria-hidden="true" />
        {t('kb_ai_locked_title', { defaultValue: 'Asking the AI is not included in this account' })}
      </p>
      <p className="text-sm text-slate-600 dark:text-theme-text-secondary">
        {t('kb_ai_locked_body', { defaultValue: 'You can still read the guides in the document library, the knowledge graph and the illustrations.' })}
      </p>
      {BILLING_ENABLED ? (
        <button type="button" onClick={() => setActiveTab('billing')} className="text-sm font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          {t('kb_quota_upgrade', { defaultValue: 'Upgrade' })}
        </button>
      ) : (
        <a href={accessRequestHref(feature)} className="text-sm font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
          {t('plan_gate_ask_access', { defaultValue: 'Ask us for access' })}
        </a>
      )}
    </div>
  );
};
