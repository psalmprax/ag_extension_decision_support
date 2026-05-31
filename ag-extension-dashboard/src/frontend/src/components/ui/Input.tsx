import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const inputVariants = cva(
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
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
        VariantProps<typeof inputVariants> {
    error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, variant, size, design, error, ...props }, ref) => {
        return (
            <div className="w-full">
                <input
                    ref={ref}
                    className={cn(inputVariants({ variant: error ? 'error' : variant, size, design, className }))}
                    {...props}
                />
                {error && (
                    <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export const InputLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => (
        <label
            ref={ref}
            className={cn('block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5', className)}
            {...props}
        />
    )
);
InputLabel.displayName = 'InputLabel';

export { inputVariants };
