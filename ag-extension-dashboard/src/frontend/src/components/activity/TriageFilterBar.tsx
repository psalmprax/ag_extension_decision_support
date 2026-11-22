import React from 'react';
import { Flame, Smartphone } from 'lucide-react';
import { formatLabel } from '@/lib/formatLabel';

export type FilterSeverity = 'all' | 'critical' | 'moderate';

/** Ranking and severity filters for the live activity stream. */
export const TriageFilterBar: React.FC<{
  filterSeverity: FilterSeverity;
  setFilterSeverity: (f: FilterSeverity) => void;
  sortByUrgency: boolean;
  onToggleUrgency: () => void;
  onOpenUSSDSimulator?: () => void;
  /** Nothing to rank or filter yet: the controls are shown disabled, not dead. */
  disabled: boolean;
}> = ({ filterSeverity, setFilterSeverity, sortByUrgency, onToggleUrgency, onOpenUSSDSimulator, disabled }) => (
  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
    {onOpenUSSDSimulator && (
      <button
        onClick={onOpenUSSDSimulator}
        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>USSD Sandbox</span>
      </button>
    )}
    <button
      onClick={onToggleUrgency}
      disabled={disabled}
      title={disabled ? 'No farmer activity to rank yet' : 'Toggle urgency heat ranking'}
      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
        sortByUrgency ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-theme-bg-secondary dark:text-slate-400 dark:border-white/[0.08]'
      }`}
    >
      <Flame className="w-3.5 h-3.5" />
      <span>Urgency Heat</span>
    </button>
    <div className="flex rounded-lg bg-slate-100 dark:bg-theme-bg-secondary/60 p-0.5 border border-slate-200 dark:border-white/[0.08]">
      {(['all', 'critical', 'moderate'] as const).map(f => (
        <button
          key={f}
          onClick={() => setFilterSeverity(f)}
          disabled={disabled}
          title={disabled ? 'No farmer activity to filter yet' : undefined}
          className={`px-2 py-1 rounded text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            filterSeverity === f ? 'bg-white text-slate-900 dark:bg-theme-bg-tertiary dark:text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {formatLabel(f)}
        </button>
      ))}
    </div>
  </div>
);
