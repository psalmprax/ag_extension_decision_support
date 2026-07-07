import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva('inline-flex items-center font-bold uppercase tracking-widest', {
  variants: {
    variant: {
      default:
        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      success: 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30',
      warning: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30',
      danger: 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30',
      info: 'bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-500/30',
    },
    size: {
      sm: 'px-2 py-0.5 text-micro',
      md: 'px-2.5 py-1 text-xxs',
    },
    design: {
      modern: 'rounded-full backdrop-blur-sm',
      classic: 'rounded-none',
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
