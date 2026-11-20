import { useMemo } from 'react';
import { useAppStore, AppState } from '@/store/useAppStore';

/**
 * Unified design system hook. There is a single ("modern") design system —
 * components should import this directly instead of prop-drilling styling.
 */
export function useThemeClasses() {
  const darkMode = useAppStore((state: AppState) => state.darkMode);

  return useMemo(() => {
    const design = 'modern' as const;

    const radiusClass = 'rounded-lg';
    // Quiet panels: a hairline border carries the edge, no blur, glow or lift.
    const panelClass =
      'bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08]';
    const headerOpacity = 'bg-white/30 dark:bg-slate-950/30';
    const btnClass =
      'rounded-md transition-colors';
    const headingClass = 'text-slate-900 dark:text-white font-medium';
    const dataClass = 'text-slate-900 dark:text-white font-medium tabular-nums';
    const subtextClass = 'text-slate-600 dark:text-slate-400';
    const cardClass = `${panelClass} ${radiusClass} p-6 relative overflow-hidden`;

    return {
      design,
      darkMode,
      radiusClass,
      panelClass,
      headerOpacity,
      btnClass,
      headingClass,
      dataClass,
      subtextClass,
      cardClass,
    };
  }, [darkMode]);
}
