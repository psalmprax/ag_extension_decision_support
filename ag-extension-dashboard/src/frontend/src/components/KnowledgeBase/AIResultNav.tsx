import React from 'react';
import { FileText, Network, BarChart2, Layers } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export type ViewMode = 'synthesis' | 'graph' | 'visuals' | 'evidence';

/** The tabs over a knowledge answer: the answer, related topics, charts and sources. */
export const AIResultNav: React.FC<{
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  graphNodeCount: number;
  hasVisuals: boolean;
  sourceCount: number;
}> = ({ viewMode, setViewMode, graphNodeCount, hasVisuals, sourceCount }) => {
  const { t } = useLanguage();
  return (
  <div className="flex items-center justify-between gap-2 pt-4 overflow-x-auto custom-scrollbar">
    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-theme-bg-primary/60 rounded-xl border border-slate-200 dark:border-white/10">
      <button
        type="button"
        aria-pressed={viewMode === 'synthesis'}
        onClick={() => setViewMode('synthesis')}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
          viewMode === 'synthesis'
            ? 'bg-emerald-500 text-slate-950 shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-theme-text-muted dark:hover:text-white dark:hover:bg-white/5'
        }`}
      >
        <FileText className="w-3.5 h-3.5" />
        <span>{t('kb_tab_answer', 'Answer')}</span>
      </button>

      <button
        type="button"
        aria-pressed={viewMode === 'graph'}
        onClick={() => setViewMode('graph')}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
          viewMode === 'graph'
            ? 'bg-emerald-500 text-slate-950 shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-theme-text-muted dark:hover:text-white dark:hover:bg-white/5'
        }`}
      >
        <Network className="w-3.5 h-3.5" />
        <span>{t('kb_tab_related', 'Related topics')}</span>
        <span className="text-xxs px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-theme-bg-secondary/60 text-slate-700 dark:text-theme-text-secondary">
          {graphNodeCount}
        </span>
      </button>

      {hasVisuals && (
        <button
          type="button"
          aria-pressed={viewMode === 'visuals'}
          onClick={() => setViewMode('visuals')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            viewMode === 'visuals'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-theme-text-muted dark:hover:text-white dark:hover:bg-white/5'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>{t('kb_tab_charts', 'Charts')}</span>
        </button>
      )}

      <button
        type="button"
        aria-pressed={viewMode === 'evidence'}
        onClick={() => setViewMode('evidence')}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
          viewMode === 'evidence'
            ? 'bg-emerald-500 text-slate-950 shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-theme-text-muted dark:hover:text-white dark:hover:bg-white/5'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>{t('kb_tab_sources', 'Sources')}</span>
        <span className="text-xxs px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-theme-bg-secondary/60 text-slate-700 dark:text-theme-text-secondary">
          {sourceCount}
        </span>
      </button>
    </div>
  </div>
  );
};
