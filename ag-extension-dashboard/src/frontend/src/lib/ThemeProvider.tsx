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
  const { themeName, darkMode, designSystemMode } = useAppStore();

  useEffect(() => {
    let activeTheme = themeName;

    if (designVariant === 'new') {
      if (themeName === 'forest') {
        activeTheme = 'oceanic';
      }
    }

    applyTheme(activeTheme);

    const root = document.documentElement;
    if (designVariant === 'new') {
      root.classList.add('design-new');
      root.classList.remove('design-current');
    } else {
      root.classList.add('design-current');
      root.classList.remove('design-new');
    }

    root.setAttribute('data-design-variant', designVariant);
    root.setAttribute('data-design-mode', designSystemMode);
  }, [designVariant, themeName, darkMode, designSystemMode]);

  return (
    <ThemeContext.Provider value={{ variant: designVariant }}>
      {children}
    </ThemeContext.Provider>
  );
};
