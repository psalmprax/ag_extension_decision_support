import React from 'react';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { X, Check } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface ABTestBannerProps {
  onClose?: () => void;
  inline?: boolean;
}

export const ABTestBanner: React.FC<ABTestBannerProps> = ({ onClose, inline = false }) => {
  const { designVariant, setDesignVariant, shouldShowABTest, setShowABTest } = useFeatureFlags();
  const { t } = useLanguage();

  if (!shouldShowABTest && !inline) return null;

  const handleClose = () => {
    setShowABTest(false);
    if (onClose) onClose();
  };

  const handleSelect = (variant: 'current' | 'new') => {
    setDesignVariant(variant);
    if (!inline) handleClose();
  };

  const content = (
    <div className={`${inline ? 'bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl'}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`font-bold text-gray-900 dark:text-white ${inline ? 'text-sm' : 'text-lg'}`}>
            {inline ? 'Design System' : 'Help Us Improve!'}
          </h3>
          {!inline && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select your preferred design experience
            </p>
          )}
        </div>
        {!inline && (
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      <div className={`grid gap-3 ${inline ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <button
          onClick={() => handleSelect('current')}
          className={`p-3 rounded-xl border-2 transition-all text-left ${
            designVariant === 'current'
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {designVariant === 'current' && (
              <Check className="w-3 h-3 text-red-500" />
            )}
            <span className={`font-bold text-gray-900 dark:text-white ${inline ? 'text-xs' : 'text-sm'}`}>
              Current Design
            </span>
          </div>
          {!inline && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The original design you know
            </p>
          )}
        </button>

        <button
          onClick={() => handleSelect('new')}
          className={`p-3 rounded-xl border-2 transition-all text-left ${
            designVariant === 'new'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {designVariant === 'new' && (
              <Check className="w-3 h-3 text-green-500" />
            )}
            <span className={`font-bold text-gray-900 dark:text-white ${inline ? 'text-xs' : 'text-sm'}`}>
              New Design 🚀
            </span>
          </div>
          {!inline && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Modern, cleaner interface
            </p>
          )}
        </button>
      </div>

      {!inline && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold"
          >
            Skip for now →
          </button>
        </div>
      )}
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-slide-up">
      {content}
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
