import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const cardVariants = cva('overflow-hidden transition-all duration-300', {
    variants: {
        variant: {
            glass: 'backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10',
            solid: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
            outlined: 'bg-transparent border border-slate-200 dark:border-slate-700',
        },
        design: {
            modern: 'rounded-2xl hover:scale-[1.01] hover:shadow-2xl',
            classic: 'rounded-none shadow-none',
        },
        padding: {
            none: '',
            sm: 'p-4',
            md: 'p-6',
            lg: 'p-8',
        },
    },
    defaultVariants: {
        variant: 'glass',
        design: 'modern',
        padding: 'md',
    },
});

export interface CardProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, design, padding, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(cardVariants({ variant, design, padding, className }))}
                {...props}
            />
        );
    }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('mb-4', className)} {...props} />
    )
);
CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('', className)} {...props} />
    )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('mt-4 pt-4 border-t border-slate-200 dark:border-white/10', className)} {...props} />
    )
);
CardFooter.displayName = 'CardFooter';

export { cardVariants };
