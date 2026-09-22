import React from 'react';
import { ABTestToggle } from './ABTestToggle';


interface DesignToggleProps {
  className?: string;
  compact?: boolean;
}

export const DesignToggle: React.FC<DesignToggleProps> = ({ className, compact = true }) => {
  return <ABTestToggle compact={compact} className={className} />;
};
