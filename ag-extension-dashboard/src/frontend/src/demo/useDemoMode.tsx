/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';

interface UseDemoModeResult {
  isDemo: boolean;
  /** Renders a disabled overlay when isDemo is true; renders children otherwise. */
  DemoBlocker: React.FC<{ children: React.ReactNode; label?: string }>;
  /** Returns true when feature is allowed, false when blocked. */
  can: () => boolean;
}

const FALLBACK_LABEL = 'Not available in demo version';
const FALLBACK_HINT = 'Sign up for a free account to unlock this feature.';

export const DemoBlocker: React.FC<{ children: React.ReactNode; label?: string }> = ({
  children,
  label,
}) => {
  const isDemo = useAppStore(s => s.isDemo);
  const { t } = useLanguage();
  const overlayLabel = label || t('demo_not_available') || FALLBACK_LABEL;
  const upgradeHint = t('demo_upgrade_hint') || FALLBACK_HINT;

  if (!isDemo) return <>{children}</>;

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-50">
        {children}
      </div>
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm rounded-2xl"
      >
        <div className="flex flex-col items-center gap-2 text-center px-6 py-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{overlayLabel}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{upgradeHint}</p>
        </div>
      </div>
    </div>
  );
};

export function useDemoMode(): UseDemoModeResult {
  const isDemo = useAppStore(s => s.isDemo);
  return { isDemo, DemoBlocker, can: () => !isDemo };
}
