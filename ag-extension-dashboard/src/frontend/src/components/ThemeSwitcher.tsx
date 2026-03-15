import React, { useState } from 'react';
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

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                <Palette className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">{t('theme_choose')}</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">{t('theme_choose')}</h3>
                            <p className="text-sm text-gray-500 mt-1">{t('theme_select_aesthetic')}</p>
                        </div>

                        <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                            {themeKeys.map((theme) => {
                                const isActive = theme === currentTheme;
                                return (
                                    <button
                                        key={theme}
                                        onClick={() => {
                                            onThemeChange(theme);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        {/* Color Preview */}
                                        <div className="flex gap-1">
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: themes[theme].primary[500] }}
                                            />
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: themes[theme].secondary[500] }}
                                            />
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: themes[theme].accent[500] }}
                                            />
                                        </div>

                                        {/* Theme Name */}
                                        <div className="flex-1 text-left">
                                            <p className={`text-sm font-black uppercase tracking-tight ${isActive ? 'text-primary-700' : 'text-gray-900 group-hover:text-primary-600'}`}>
                                                {theme.charAt(0).toUpperCase() + theme.slice(1)}
                                            </p>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{themeDescriptions[theme]}</p>
                                        </div>

                                        {/* Checkmark */}
                                        {isActive && (
                                            <Check className="w-5 h-5 text-primary-600" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-3 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-4 h-4" />
                                {t('theme_close')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

/**
 * Theme Preview Card - Shows all themes at once
 */
export const ThemePreview: React.FC<{ onSelect: (theme: ThemeName) => void }> = ({ onSelect }) => {
    const themeKeys = Object.keys(themes) as ThemeName[];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {themeKeys.map((theme) => (
                <button
                    key={theme}
                    onClick={() => onSelect(theme)}
                    className="group relative overflow-hidden rounded-xl border-2 border-transparent hover:border-gray-300 transition-all"
                >
                    {/* Color Bar */}
                    <div className="flex h-16">
                        <div
                            className="flex-1"
                            style={{ backgroundColor: themes[theme].primary[500] }}
                        />
                        <div
                            className="flex-1"
                            style={{ backgroundColor: themes[theme].secondary[500] }}
                        />
                        <div
                            className="flex-1"
                            style={{ backgroundColor: themes[theme].accent[500] }}
                        />
                    </div>

                    {/* Background Preview */}
                    <div
                        className="p-3 text-left"
                        style={{ backgroundColor: themes[theme].background.primary }}
                    >
                        <p className="font-medium text-gray-900">{theme.charAt(0).toUpperCase() + theme.slice(1)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{themeDescriptions[theme]}</p>
                    </div>
                </button>
            ))}
        </div>
    );
};

export default ThemeSwitcher;
