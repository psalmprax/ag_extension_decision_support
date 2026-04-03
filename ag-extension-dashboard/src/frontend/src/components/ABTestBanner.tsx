import React from 'react';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { X, Eye, Check } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface ABTestBannerProps {
  onClose?: () => void;
}

export const ABTestBanner: React.FC<ABTestBannerProps> = ({ onClose }) => {
  const { designVariant, setDesignVariant, shouldShowABTest } = useFeatureFlags();
  const { t } = useLanguage();

  if (!shouldShowABTest) return null;

  const handleSelect = (variant: 'current' | 'new') => {
    setDesignVariant(variant);
    if (onClose) onClose();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Help Us Improve!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select your preferred design experience
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleSelect('current')}
            className={`p-4 rounded-xl border-2 transition-all ${
              designVariant === 'current'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {designVariant === 'current' && (
                <Check className="w-4 h-4 text-red-500" />
              )}
              <span className="font-semibold text-gray-900 dark:text-white">
                Current Design
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
              The original design you know
            </p>
          </button>

          <button
            onClick={() => handleSelect('new')}
            className={`p-4 rounded-xl border-2 transition-all ${
              designVariant === 'new'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {designVariant === 'new' && (
                <Check className="w-4 h-4 text-green-500" />
              )}
              <span className="font-semibold text-gray-900 dark:text-white">
                New Design
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
              Modern, cleaner interface
            </p>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Skip for now →
          </button>
        </div>
      </div>
    </div>
  );
};

interface DesignToggleProps {
  className?: string;
}

export const DesignToggle: React.FC<DesignToggleProps> = ({ className }) => {
  const { designVariant, setDesignVariant } = useFeatureFlags();
  const { t } = useLanguage();

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

export default ABTestBanner;
