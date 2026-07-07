import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const textareaVariants = cva(
  'w-full transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y',
  {
    variants: {
      variant: {
        default: 'border-slate-300 dark:border-white/10 focus:ring-2 focus:ring-primary-400/50',
        error: 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-400/50',
      },
      design: {
        modern: 'rounded-xl bg-white/5 border placeholder-slate-400',
        classic: 'rounded-none border bg-white dark:bg-slate-800 placeholder-slate-500',
      },
    },
    defaultVariants: {
      variant: 'default',
      design: 'modern',
    },
  }
);

export interface TextareaProps
  extends
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    VariantProps<typeof textareaVariants> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, design, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            'min-h-[80px] px-4 py-2.5 text-sm',
            textareaVariants({ variant: error ? 'error' : variant, design, className })
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
