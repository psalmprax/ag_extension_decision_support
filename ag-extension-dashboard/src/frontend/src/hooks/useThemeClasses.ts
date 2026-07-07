import { useMemo } from 'react';
import { useAppStore, AppState } from '@/store/useAppStore';

/**
 * Unified design system hook. Superset of useDesignSystemMode.
 * Returns both the `design` prop for CVA primitives and legacy class strings
 * for gradual migration.
 *
 * Components should import this directly — no prop drilling needed.
 */
export function useThemeClasses() {
  const designSystemMode = useAppStore((state: AppState) => state.designSystemMode);
  const darkMode = useAppStore((state: AppState) => state.darkMode);

  const isModern = designSystemMode === 'modern';

  return useMemo(() => {
    const design = (isModern ? 'modern' : 'classic') as 'modern' | 'classic';

    // Legacy strings for gradual migration (same as useDesignSystemMode)
    const radiusClass = isModern ? 'rounded-2xl' : 'rounded-none';
    const panelClass = isModern
      ? 'backdrop-blur-xl bg-white/70 dark:bg-white/5 shadow-[inset_0_1px_1px_var(--color-outline)] border border-white/10'
      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-none';
    const headerOpacity = isModern
      ? 'bg-white/30 dark:bg-slate-950/30'
      : 'bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800';
    const btnClass = isModern
      ? 'rounded-xl hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_var(--color-outline)]'
      : 'rounded-none border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono text-xxs uppercase tracking-widest';
    const headingClass = isModern
      ? 'text-cyan-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-cyan-200 dark:to-emerald-200 dark:drop-shadow-[0_0_15px_var(--color-outline)] font-black tracking-tighter'
      : 'text-slate-900 dark:text-white font-bold';
    const dataClass = isModern
      ? 'text-cyan-900 dark:text-cyan-400 font-black tracking-tighter dark:drop-shadow-[0_0_8px_var(--color-outline)]'
      : 'text-slate-900 dark:text-white font-bold';
    const subtextClass = isModern
      ? 'text-slate-600 dark:text-slate-400'
      : 'text-slate-500 dark:text-slate-400';
    const cardClass = `${panelClass} ${radiusClass} p-6 relative overflow-hidden transition-all duration-300 ${isModern ? 'hover:scale-[1.01] hover:shadow-2xl' : ''}`;

    return {
      // Primary API for new code
      design,
      isModern,
      darkMode,
      // Legacy strings for gradual migration
      radiusClass,
      panelClass,
      headerOpacity,
      btnClass,
      headingClass,
      dataClass,
      subtextClass,
      cardClass,
    };
  }, [isModern, darkMode]);
}
