import React, { useEffect, useState } from 'react';
import { themes, ThemeName, themeDescriptions } from '@/theme';
import { Palette, Check, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface ThemeSwitcherProps {
  currentTheme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, onThemeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  const themeKeys = Object.keys(themes) as ThemeName[];

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] hover:border-primary-400/50 transition-all text-slate-800 hover:text-primary-700 dark:text-theme-text-secondary dark:hover:text-primary-400"
      >
        <Palette className="w-4 h-4" aria-hidden="true" />
        <span className="text-xxs font-medium  ">{t('theme_choose')}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute end-0 mt-2 w-72 popover-surface rounded-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
              <h3 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary tracking-tight">
                {t('theme_choose')}
              </h3>
              <p className="text-xxs text-slate-600 dark:text-theme-text-muted mt-1 font-medium">
                {t('theme_select_aesthetic')}
              </p>
            </div>

            <div role="listbox" aria-label={t('theme_choose')} className="p-2 space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
              {themeKeys.map(theme => {
                const isActive = theme === currentTheme;
                return (
                  <button
                    key={theme}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onThemeChange(theme);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary-400/10 border border-primary-400/30'
                        : 'hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    {/* Color Preview */}
                    <div className="flex gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: themes[theme].primary[500] }}
                      />
                    </div>

                    {/* Theme Name */}
                    <div className="flex-1 text-start">
                      <p className={`text-xs font-medium ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-slate-800 dark:text-theme-text-secondary'}`}>
                        {themeDescriptions[theme]}
                      </p>
                    </div>

                    {/* Checkmark */}
                    {isActive && <Check className="w-4 h-4 text-primary-700 dark:text-primary-400" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 text-xxs font-medium text-slate-600 hover:text-slate-900 dark:text-theme-text-muted dark:hover:text-theme-text-primary transition-colors"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                {t('theme_close')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSwitcher;
