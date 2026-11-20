import { cn } from '@/lib/cn';

/** Primary and secondary button looks used in page headers and empty states. */
export const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors disabled:opacity-50';
export const SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-2 h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.14] text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] text-sm transition-colors disabled:opacity-50';

/** A tab or filter button in a page header row: tinted when selected, plain otherwise. */
export function tabButtonClass(active: boolean): string {
  return cn(
    'h-8 px-3 rounded-md text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap',
    active
      ? 'bg-emerald-50 dark:bg-emerald-400/[0.1] text-emerald-800 dark:text-emerald-200 font-medium'
      : 'text-slate-600 dark:text-white/60 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
  );
}

/** The form card on the sign-in and registration pages (inside AuthLayout). */
export const AUTH_CARD = 'bg-[#13241b] border border-white/[0.08] rounded-lg p-7 sm:p-8 w-full';
