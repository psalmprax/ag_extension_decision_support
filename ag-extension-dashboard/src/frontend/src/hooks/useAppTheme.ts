import { useEffect } from 'react';
import { applyTheme, ThemeName } from '@/theme';

export const useAppTheme = (themeName: ThemeName, darkMode: boolean) => {
  // Apply theme when it changes (emits light + dark CSS vars via a style element).
  useEffect(() => {
    applyTheme(themeName);
    localStorage.setItem('ag-theme-name', themeName);
  }, [themeName]);

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
};
