import { cva, type VariantProps } from 'class-variance-authority';

export const inputVariants = cva(
  'w-full transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-slate-300 dark:border-white/10 focus:ring-2 focus:ring-primary-400/50',
        error: 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-400/50',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2.5 text-sm',
        lg: 'h-12 px-4 text-base',
      },
      design: {
        modern: 'rounded-xl bg-white/5 border placeholder-slate-400',
        classic: 'rounded-none border bg-white dark:bg-slate-800 placeholder-slate-500',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      design: 'modern',
    },
  }
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  error?: string;
}
