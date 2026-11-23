import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
        secondary:
          'bg-white text-slate-800 border border-slate-900/[0.12] hover:bg-slate-50 dark:bg-white/[0.04] dark:text-theme-text-primary dark:border-white/[0.12] dark:hover:bg-white/[0.08]',
        ghost:
          'text-slate-600 dark:text-theme-text-secondary hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2.5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      design: {
        modern: 'rounded-lg',
        classic: 'rounded-md border border-slate-900/[0.12] dark:border-white/[0.12]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      design: 'modern',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}
