import React from 'react';
import { useFeatureFlags } from '@/store/useFeatureFlags';

interface DesignToggleProps {
  className?: string;
}

export const DesignToggle: React.FC<DesignToggleProps> = ({ className }) => {
  const { designVariant, setDesignVariant } = useFeatureFlags();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-500 dark:text-gray-400">Design:</span>
      <button
        onClick={() => setDesignVariant('current')}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
          designVariant === 'current'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        Current
      </button>
      <button
        onClick={() => setDesignVariant('new')}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
          designVariant === 'new'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        New
      </button>
    </div>
  );
};
