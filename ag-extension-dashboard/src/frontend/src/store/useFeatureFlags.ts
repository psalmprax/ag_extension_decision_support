import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DesignVariant = 'classic' | 'base' | 'current' | 'new';

interface FeatureFlags {
  designVariant: DesignVariant;
  setDesignVariant: (variant: DesignVariant) => void;
  toggleDesignVariant: () => void;
  isBaseDesign: () => boolean;
  shouldShowABTest: boolean;
  setShowABTest: (show: boolean) => void;
}

export const useFeatureFlags = create<FeatureFlags>()(
  persist(
    (set, get) => ({
      designVariant: 'base', // Default to Base App modern aesthetic for evaluation
      isBaseDesign: () => {
        const v = get().designVariant;
        return v === 'base' || v === 'new';
      },
      setDesignVariant: variant => {
        set({ designVariant: variant });
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          const isBase = variant === 'base' || variant === 'new';
          root.setAttribute('data-design-variant', isBase ? 'base' : 'classic');
          if (isBase) {
            root.classList.add('design-base', 'design-new');
            root.classList.remove('design-classic', 'design-current');
          } else {
            root.classList.add('design-classic', 'design-current');
            root.classList.remove('design-base', 'design-new');
          }
        }
      },
      toggleDesignVariant: () => {
        const current = get().designVariant;
        const isCurrentlyBase = current === 'base' || current === 'new';
        const next: DesignVariant = isCurrentlyBase ? 'classic' : 'base';
        get().setDesignVariant(next);
      },
      shouldShowABTest: true,
      setShowABTest: show => set({ shouldShowABTest: show }),
    }),
    {
      name: 'ag-feature-flags',
    }
  )
);

export const isBaseDesign = () => {
  if (typeof window === 'undefined') return true;
  const flags = useFeatureFlags.getState();
  return flags.designVariant === 'base' || flags.designVariant === 'new';
};

export const isNewDesign = isBaseDesign;
