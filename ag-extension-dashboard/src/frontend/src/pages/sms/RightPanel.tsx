import React from 'react';
import { Plus, Zap } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import type { SMSMessage } from './types';
import { QuotaSummary, MessageStats, TemplateList } from './widgets';

export function SMSRightPanel({
  quota,
  isLoadingQuota,
  history,
  templates,
  applyTemplate,
  onClose,
  radiusClass,
}: {
  quota: { current: number; limit: number; sent: number; failed: number };
  isLoadingQuota: boolean;
  history: SMSMessage[];
  templates: {
    id: string;
    title: string;
    content: string;
    icon: React.ElementType;
    color: string;
  }[];
  applyTemplate: (content: string) => void;
  onClose: () => void;
  radiusClass: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="w-full lg:w-1/4 space-y-4 overflow-y-auto pr-1">
      {/* GLASS DASHBOARD CARD */}
      <div
        className="relative overflow-hidden backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-5 shadow-xl space-y-5"
      >
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            {t('sms_quota_title') || 'Delivery & Quota'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <QuotaSummary quota={quota} isLoadingQuota={isLoadingQuota} radiusClass={radiusClass} />
          <MessageStats history={history} t={t} radiusClass={radiusClass} />
        </div>
      </div>

      {/* TEMPLATES CARD */}
      <div
        className={`bg-white dark:bg-slate-900 ${radiusClass} border border-slate-200 dark:border-slate-800 p-6 flex flex-col shadow-sm`}
      >
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('sms_template_title')}
        </h3>
        <TemplateList templates={templates} applyTemplate={applyTemplate} radiusClass={radiusClass} />
      </div>
    </div>
  );
}
