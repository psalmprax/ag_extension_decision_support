import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
                secondary: 'bg-white/10 border border-white/20 text-white hover:bg-white/20 dark:bg-white/5 dark:border-white/10',
                ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white',
                danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
            },
            size: {
                sm: 'h-8 px-3 text-xs',
                md: 'h-10 px-4 py-2.5 text-sm',
                lg: 'h-12 px-6 text-base',
            },
            design: {
                modern: 'rounded-xl hover:scale-[1.02] active:scale-[0.98]',
                classic: 'rounded-none font-mono text-[10px] uppercase tracking-widest border border-slate-300 dark:border-slate-700',
            },
        },
        compoundVariants: [
            // Modern primary gets neon glow
            { variant: 'primary', design: 'modern', className: 'shadow-[0_0_20px_rgba(34,211,238,0.2)]' },
            // Classic primary removes scale effect
            { variant: 'primary', design: 'classic', className: 'hover:scale-100 active:scale-100' },
            // Classic ghost gets border on hover
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
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, design, loading, children, disabled, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, design, className }))}
                ref={ref}
                disabled={disabled || loading}
                {...props}
            >
                {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                )}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
export { buttonVariants };
