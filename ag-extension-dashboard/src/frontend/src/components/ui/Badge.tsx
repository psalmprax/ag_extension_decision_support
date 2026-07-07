import React from 'react';
import { cn } from '@/lib/cn';
import { badgeVariants, type BadgeProps } from './Badge.variants';

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, design, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, design, className }))}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
