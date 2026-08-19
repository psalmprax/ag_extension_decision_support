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

    const radiusClass = 'rounded-xl';
    const panelClass =
      'backdrop-blur-xl bg-white/70 dark:bg-white/5 shadow-[inset_0_1px_1px_var(--color-outline)] border border-white/10';
    const headerOpacity = 'bg-white/30 dark:bg-slate-950/30';
    const btnClass =
      'rounded-xl hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_var(--color-outline)]';
    const headingClass = 'text-gray-900 dark:text-white font-black tracking-tight';
    const dataClass = 'text-gray-900 dark:text-white font-black tracking-tight';
    const subtextClass = 'text-slate-600 dark:text-slate-400';
    const cardClass = `${panelClass} ${radiusClass} p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl`;

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
