import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva('inline-flex items-center font-medium', {
  variants: {
    variant: {
      default:
        'bg-slate-100 text-slate-700 dark:bg-theme-bg-tertiary dark:text-slate-300 border border-slate-200 dark:border-white/[0.12]',
      success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/[0.12] dark:text-emerald-200 border border-emerald-700/15',
      warning: 'bg-amber-50 text-amber-800 dark:bg-amber-400/[0.12] dark:text-amber-200 border border-amber-700/15',
      danger: 'bg-red-50 text-red-800 dark:bg-red-400/[0.12] dark:text-red-200 border border-red-700/15',
      info: 'bg-sky-50 text-sky-800 dark:bg-sky-400/[0.12] dark:text-sky-200 border border-sky-700/15',
    },
    size: {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
    },
    design: {
      modern: 'rounded-full',
      classic: 'rounded-md',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
    design: 'modern',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
