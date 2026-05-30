import { useEffect } from 'react';
import { themes, getThemeCSS, applyTheme, ThemeName } from '@/theme';

export const useAppTheme = (themeName: ThemeName, darkMode: boolean) => {
    // Apply theme when it changes
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

    // Apply theme CSS variables
    useEffect(() => {
        localStorage.setItem('ag-theme-name', themeName);
        const root = document.documentElement;
        const cssVars = getThemeCSS(themeName);
        const varsArray = cssVars.split(';').filter(v => v.trim());
        varsArray.forEach(v => {
            const [name, value] = v.split(':');
            if (name && value) {
                root.style.setProperty(name.trim(), value.trim());
            }
        });
    }, [themeName]);
};
