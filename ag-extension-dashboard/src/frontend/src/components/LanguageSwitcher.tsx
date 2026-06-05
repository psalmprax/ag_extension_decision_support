'use client';

import React from 'react';
import { useLanguage } from '../lib/LanguageContext';
import { languages, Language } from '../lib/i18n';

interface LanguageSwitcherProps {
    className?: string;
    showFlag?: boolean;
    compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
    className = '',
    showFlag = true,
    compact = false
}) => {
    const { language, setLanguage, t } = useLanguage();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLanguage(e.target.value as Language);
    };

    if (compact) {
        return (
            <select
                value={language}
                onChange={handleChange}
                className={`bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-primary-400/50 text-slate-300 hover:text-white transition-all backdrop-blur-xl ${className}`}
                aria-label={t('common_select_language')}
            >
                {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {showFlag ? `${lang.flag} ${lang.code.toUpperCase()}` : lang.name}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <label htmlFor="language-select" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {t('common_select_language')}:
            </label>
            <select
                id="language-select"
                value={language}
                onChange={handleChange}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            >
                {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="dark:bg-gray-900">
                        {showFlag ? `${lang.flag} ${lang.name}` : lang.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default LanguageSwitcher;
