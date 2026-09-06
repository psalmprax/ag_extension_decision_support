import { createContext, useContext } from 'react';

export interface ThemeContextType {
  variant: 'current' | 'new' | 'classic' | 'base';
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
