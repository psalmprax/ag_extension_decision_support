import { useEffect } from 'react';
import { applyTheme, ThemeName } from '@/theme';
import { safeStorage } from '@/lib/safeStorage';

export const useAppTheme = (themeName: ThemeName, darkMode: boolean) => {
  // Apply theme when it changes (emits light + dark CSS vars via a style element).
  useEffect(() => {
    applyTheme(themeName);
    safeStorage.set('ag-theme-name', themeName);
  }, [themeName]);

  // Apply dark mode class. Native widgets (scrollbars, form controls, the
  // canvas background) are painted from <meta name="color-scheme">, so it has
  // to follow the override rather than staying at the document-wide default.
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      safeStorage.set('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      safeStorage.set('theme', 'light');
    }
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute('content', darkMode ? 'dark' : 'light');
  }, [darkMode]);
};
