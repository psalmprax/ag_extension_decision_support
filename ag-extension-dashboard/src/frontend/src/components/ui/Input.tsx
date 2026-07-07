import React from 'react';
import { cn } from '@/lib/cn';
import { inputVariants, type InputProps } from './Input.variants';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, design, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            inputVariants({ variant: error ? 'error' : variant, size, design, className })
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const InputLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn('block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5', className)}
    {...props}
  />
));
InputLabel.displayName = 'InputLabel';
