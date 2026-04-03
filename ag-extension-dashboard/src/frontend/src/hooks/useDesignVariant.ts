import { useFeatureFlags } from '@/store/useFeatureFlags';
import { useMemo } from 'react';

interface UseDesignOptions<T> {
  current: T;
  new: T;
}

export function useDesign<T>(options: UseDesignOptions<T>): T {
  const { designVariant } = useFeatureFlags();
  return useMemo(() => {
    return designVariant === 'new' ? options.new : options.current;
  }, [designVariant, options]);
}

export function useNewDesign(): boolean {
  const { designVariant } = useFeatureFlags();
  return designVariant === 'new';
}

export function useCurrentDesign(): boolean {
  const { designVariant } = useFeatureFlags();
  return designVariant === 'current';
}
