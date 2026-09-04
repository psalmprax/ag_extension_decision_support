import React from 'react';
import { Zap } from 'lucide-react';
import type { KnowledgeQuotaData } from '@/api/knowledgeService';

export const QuotaChip: React.FC<{ quota: KnowledgeQuotaData; onUpgrade: () => void }> = ({ quota, onUpgrade }) => (
  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono">
    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
    <span className="text-white/70">DAILY QUOTA:</span>
    {quota.isFree === false || quota.limit === -1 ? (
      <span className="text-emerald-300 font-bold">Unlimited</span>
    ) : (
      <span className="text-white font-bold">{quota.remaining}/{quota.limit}</span>
    )}
    {quota.isFree !== false && quota.remaining <= 1 && quota.limit !== -1 && (
      <button
        onClick={onUpgrade}
        className="ml-1 underline font-bold text-amber-300 hover:text-amber-200"
      >
        Upgrade
      </button>
    )}
  </div>
);
