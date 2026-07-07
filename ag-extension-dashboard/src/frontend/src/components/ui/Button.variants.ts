import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
        secondary:
          'bg-white/10 border border-white/20 text-white hover:bg-white/20 dark:bg-white/5 dark:border-white/10',
        ghost:
          'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2.5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      design: {
        modern: 'rounded-xl hover:scale-[1.02] active:scale-[0.98]',
        classic:
          'rounded-none font-mono text-xxs uppercase tracking-widest border border-slate-300 dark:border-slate-700',
      },
    },
    compoundVariants: [
      { variant: 'primary', design: 'modern', className: 'shadow-[0_0_20px_var(--color-outline)]' },
      { variant: 'primary', design: 'classic', className: 'hover:scale-100 active:scale-100' },
      { variant: 'ghost', design: 'classic', className: 'hover:scale-100 active:scale-100' },
    ],
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
