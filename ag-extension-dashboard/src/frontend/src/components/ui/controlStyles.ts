import { cn } from '@/lib/cn';

/** Primary and secondary button looks used in page headers and empty states. */
export const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md whitespace-nowrap bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition-colors disabled:opacity-50';
export const SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-2 h-10 px-3 rounded-md whitespace-nowrap border border-slate-900/[0.12] dark:border-white/[0.14] text-slate-700 dark:text-slate-200 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] text-sm transition-colors disabled:opacity-50';

/** A tab or filter button in a page header row: tinted when selected, plain otherwise. */
export function tabButtonClass(active: boolean): string {
  return cn(
    'h-8 px-3 rounded-md text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap',
    active
      ? 'bg-emerald-50 dark:bg-emerald-400/[0.1] text-emerald-800 dark:text-emerald-200 font-medium'
      : 'text-slate-600 dark:text-white/60 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
  );
}

/** The row that holds tab buttons; wraps onto a second line on phones instead of hiding tabs off-screen. */
export const TAB_ROW = 'flex flex-wrap items-center gap-1';

/** A text field and the main button on the dark sign-in pages. */
export const AUTH_INPUT =
  'w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors';
export const AUTH_SUBMIT =
  'w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#13241b] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';

/** The form card on the sign-in and registration pages (inside AuthLayout). */
export const AUTH_CARD = 'bg-[#13241b] border border-white/[0.08] rounded-lg p-7 sm:p-8 w-full';
