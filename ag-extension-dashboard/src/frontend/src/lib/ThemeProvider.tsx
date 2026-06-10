import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import { useAppStore } from '@/store/useAppStore';
import { applyTheme } from '@/theme';

interface ThemeContextType {
  variant: 'current' | 'new';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { designVariant } = useFeatureFlags();
  const { themeName, darkMode, designSystemMode } = useAppStore();

  useEffect(() => {
    // Determine the active theme based on design variant
    // If 'new', we might want to default to a specific premium theme
    // such as 'cyber' or 'oceanic' if using 'forest' as current.
    
    let activeTheme = themeName;
    
    if (designVariant === 'new') {
      // In 'new' mode, we override or shift colors to the Blue/Silver palette 
      // if the user is currently on 'forest' (default).
      if (themeName === 'forest') {
        activeTheme = 'oceanic';
      }
    } else {
      // In 'current' mode, if they were on 'oceanic', we might want to shift back?
      // For now, we respect the themeName but apply variant-specific root variables.
    }

    applyTheme(activeTheme);

    // Apply variant-specific global class to document root
    const root = document.documentElement;
    if (designVariant === 'new') {
      root.classList.add('design-new');
      root.classList.remove('design-current');
    } else {
      root.classList.add('design-current');
      root.classList.remove('design-new');
    }
    
    // Track variant in data attribute for CSS selectors
    root.setAttribute('data-design-variant', designVariant);
    root.setAttribute('data-design-mode', designSystemMode);
    
  }, [designVariant, themeName, darkMode, designSystemMode]);

  return (
    <ThemeContext.Provider value={{ variant: designVariant }}>
      {children}
    </ThemeContext.Provider>
  );
};
