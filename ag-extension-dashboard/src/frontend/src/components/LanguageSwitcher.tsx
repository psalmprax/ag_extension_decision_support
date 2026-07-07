'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
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
  compact = false,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return languages;
    const q = query.toLowerCase();
    return languages.filter(
      l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [query]);

  const current = languages.find(l => l.code === language) ?? languages[0];

  if (compact) {
    return (
      <div ref={ref} className={`relative ${className}`}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xxs font-black uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-cyan-400/50 text-slate-300 hover:text-white transition-all backdrop-blur-xl"
          aria-label={t('common_select_language')}
          aria-expanded={open}
        >
          {showFlag && <span>{current.flag}</span>}
          <span>{current.code.toUpperCase()}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {open && (
          <LanguageDropdown
            filtered={filtered}
            query={query}
            setQuery={setQuery}
            currentCode={current.code}
            onSelect={code => {
              setLanguage(code as Language);
              setOpen(false);
              setQuery('');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="language-select"
        className="text-xxs font-black uppercase tracking-widest text-gray-400"
      >
        {t('common_select_language')}:
      </label>
      <div ref={ref} className="relative">
        <button
          id="language-select"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xxs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white min-w-[160px] justify-between"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            {showFlag && <span>{current.flag}</span>}
            <span>{current.name}</span>
          </span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {open && (
          <LanguageDropdown
            filtered={filtered}
            query={query}
            setQuery={setQuery}
            currentCode={current.code}
            onSelect={code => {
              setLanguage(code as Language);
              setOpen(false);
              setQuery('');
            }}
          />
        )}
      </div>
    </div>
  );
};

interface DropdownProps {
  filtered: typeof languages;
  query: string;
  setQuery: (q: string) => void;
  currentCode: string;
  onSelect: (code: string) => void;
}

const LanguageDropdown: React.FC<DropdownProps> = ({
  filtered,
  query,
  setQuery,
  currentCode,
  onSelect,
}) => (
  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
    <div className="p-2 border-b border-gray-100 dark:border-white/10">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search languages..."
          className="w-full pl-8 pr-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
    <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-xs text-gray-400">No languages match "{query}"</li>
      ) : (
        filtered.map(lang => (
          <li key={lang.code}>
            <button
              role="option"
              aria-selected={lang.code === currentCode}
              onClick={() => onSelect(lang.code)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                lang.code === currentCode
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{lang.flag}</span>
                <span className="font-medium">{lang.name}</span>
              </span>
              {lang.code === currentCode && (
                <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
              )}
            </button>
          </li>
        ))
      )}
    </ul>
  </div>
);

export default LanguageSwitcher;
