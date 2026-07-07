import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type DesignVariant = 'current' | 'new';

interface FeatureFlags {
  designVariant: DesignVariant;
  setDesignVariant: (variant: DesignVariant) => void;
  shouldShowABTest: boolean;
  setShowABTest: (show: boolean) => void;
}

export const useFeatureFlags = create<FeatureFlags>()(
  persist(
    set => ({
      designVariant: 'current',
      setDesignVariant: variant => set({ designVariant: variant }),
      shouldShowABTest: true,
      setShowABTest: show => set({ shouldShowABTest: show }),
    }),
    {
      name: 'ag-feature-flags',
    }
  )
);

export const isNewDesign = () => {
  if (typeof window === 'undefined') return false;
  const flags = useFeatureFlags.getState();
  return flags.designVariant === 'new';
};
