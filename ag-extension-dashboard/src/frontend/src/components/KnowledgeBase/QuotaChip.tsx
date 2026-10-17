import React from 'react';
import { Zap } from 'lucide-react';
import type { KnowledgeQuotaData } from '@/api/knowledgeService';

export const QuotaChip: React.FC<{ quota: KnowledgeQuotaData; onUpgrade: () => void }> = ({ quota, onUpgrade }) => (
  <div className="flex items-center gap-2 bg-slate-100 dark:bg-black/40 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/5 text-xxs font-mono">
    <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
    <span className="text-slate-600 dark:text-white/70">DAILY QUOTA:</span>
    {quota.limit === -1 ? (
      <span className="text-emerald-700 dark:text-emerald-300 font-bold">Unlimited</span>
    ) : (
      <span className="text-slate-900 dark:text-white font-bold">{quota.remaining}/{quota.limit}</span>
    )}
    {quota.isFree && quota.remaining <= 1 && quota.limit !== -1 && (
      <button
        onClick={onUpgrade}
        className="ml-1 underline font-bold text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
      >
        Upgrade
      </button>
    )}
  </div>
);
