import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const selectVariants = cva(
    'w-full transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer',
    {
        variants: {
            variant: {
                default: 'border-slate-300 dark:border-white/10 focus:ring-2 focus:ring-primary-400/50',
                error: 'border-red-500 dark:border-red-400 focus:ring-2 focus:ring-red-400/50',
            },
            size: {
                sm: 'h-8 pl-3 pr-8 text-xs',
                md: 'h-10 pl-4 pr-10 text-sm',
                lg: 'h-12 pl-4 pr-10 text-base',
            },
            design: {
                modern: 'rounded-xl bg-white/5 border',
                classic: 'rounded-none border bg-white dark:bg-slate-800',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'md',
            design: 'modern',
        },
    }
);

export interface SelectProps
    extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
        VariantProps<typeof selectVariants> {
    error?: string;
    options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, variant, size, design, error, options, ...props }, ref) => {
        return (
            <div className="relative w-full">
                <select
                    ref={ref}
                    className={cn(selectVariants({ variant: error ? 'error' : variant, size, design, className }))}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                {error && (
                    <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';
