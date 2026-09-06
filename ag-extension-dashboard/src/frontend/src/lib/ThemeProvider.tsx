import React, { useEffect, ReactNode } from 'react';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { useAppStore } from '@/store/useAppStore';
import { applyTheme } from '@/theme';
import { ThemeContext } from './useTheme';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { designVariant } = useFeatureFlags();
  const { themeName, darkMode } = useAppStore();

  useEffect(() => {
    const isBase = designVariant === 'base' || designVariant === 'new';
    const activeTheme = themeName;

    applyTheme(activeTheme);

    const root = document.documentElement;
    if (isBase) {
      root.classList.add('design-base', 'design-new');
      root.classList.remove('design-classic', 'design-current');
    } else {
      root.classList.add('design-classic', 'design-current');
      root.classList.remove('design-base', 'design-new');
    }

    root.setAttribute('data-design-variant', isBase ? 'base' : 'classic');
  }, [designVariant, themeName, darkMode]);

  return (
    <ThemeContext.Provider value={{ variant: designVariant }}>{children}</ThemeContext.Provider>
  );
};
