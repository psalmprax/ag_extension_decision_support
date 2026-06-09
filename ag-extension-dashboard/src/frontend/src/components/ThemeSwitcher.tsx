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
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/50 transition-all text-slate-300 hover:text-cyan-400"
            >
                <Palette className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t('theme_choose')}</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                            <h3 className="text-sm font-bold text-white uppercase tracking-tight">{t('theme_choose')}</h3>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">{t('theme_select_aesthetic')}</p>
                        </div>

                        <div className="p-2 space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
                            {themeKeys.map((theme) => {
                                const isActive = theme === currentTheme;
                                return (
                                    <button
                                        key={theme}
                                        onClick={() => {
                                            onThemeChange(theme);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-cyan-400/10 border border-cyan-400/30' : 'hover:bg-white/5 border border-transparent'
                                            }`}
                                    >
                                        {/* Color Preview */}
                                        <div className="flex gap-1">
                                            <div
                                                className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]"
                                                style={{ backgroundColor: themes[theme].primary[500] }}
                                            />
                                        </div>

                                        {/* Theme Name */}
                                        <div className="flex-1 text-left">
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-cyan-400' : 'text-slate-300'}`}>
                                                {theme}
                                            </p>
                                            <p className="text-[9px] font-medium text-slate-500 mt-0.5">{themeDescriptions[theme]}</p>
                                        </div>

                                        {/* Checkmark */}
                                        {isActive && (
                                            <Check className="w-4 h-4 text-cyan-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-3 border-t border-white/10 bg-black/20">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                            >
                                <X className="w-3 h-3" />
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
