'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Globe } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { languages, Language } from '../lib/i18n';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
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
          className="flex items-center gap-1.5 h-10 px-2.5 rounded-md text-sm text-slate-600 dark:text-theme-text-secondary hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white transition-colors"
          aria-label={`${current.code.toUpperCase()} · ${t('common_select_language')}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Globe className="w-4 h-4" aria-hidden="true" />
          <span>{current.code.toUpperCase()}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
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
        className="text-sm text-slate-500 dark:text-theme-text-muted"
      >
        {t('common_select_language')}:
      </label>
      <div ref={ref} className="relative">
        <button
          id="language-select"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 bg-white dark:bg-theme-bg-tertiary border border-gray-200 dark:border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white min-w-[160px] justify-between"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
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
  // Sets its own text colour: the switcher also sits on pages that are dark in both themes
  // (landing, sign-in), and inherited white text would vanish on this panel in light mode.
  <div className="absolute end-0 mt-2 w-64 bg-white dark:bg-theme-bg-secondary text-slate-900 dark:text-theme-text-primary border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
    <div className="p-2 border-b border-gray-100 dark:border-white/10">
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-theme-text-muted" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search languages"
          className="w-full ps-8 pe-2 py-1.5 text-xs bg-gray-50 dark:bg-theme-bg-tertiary text-slate-900 dark:text-theme-text-primary placeholder:text-slate-500 dark:placeholder:text-theme-text-muted border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
    <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
      {filtered.length === 0 ? (
        <li className="px-3 py-2 text-xs text-slate-500 dark:text-theme-text-muted">No languages match "{query}"</li>
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
                  : 'text-gray-700 dark:text-theme-text-primary'
              }`}
            >
              <span className="flex items-center gap-2">
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
