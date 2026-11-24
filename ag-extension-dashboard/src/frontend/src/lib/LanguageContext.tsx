'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setAppLanguage } from './appLocale';
import { Language } from './i18n';
import { interpolate } from './interpolate';
import { safeStorage } from '@/lib/safeStorage';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (
    key: string,
    options?: string | ({ defaultValue?: string } & Record<string, unknown>),
    params?: Record<string, unknown>
  ) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Languages that use Right-to-Left direction
const RTL_LANGUAGES: Language[] = ['ar', 'ur'];

function resolveTranslation(
  key: string,
  language: Language,
  cache: Record<string, Record<string, string>>
): string | undefined {
  return cache[language]?.[key] ?? cache['en']?.[key];
}

/** The saved language, or null when there is none or the browser blocks storage. */
function readSavedLanguage(): Language | null {
  return safeStorage.get('preferred_language') as Language | null;
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [translationsCache, setTranslationsCache] = useState<
    Record<string, Record<string, string>>
  >({});
  const [isLoaded, setIsLoaded] = useState(false);

  const loadLanguage = async (lang: Language) => {
    if (translationsCache[lang]) return;

    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang}`);
      const data = await response.json();
      setTranslationsCache(prev => ({ ...prev, [lang]: data }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`[i18n] Error loading language ${lang}:`, error);
      }
      // If failed and not English, ensure we at least have English fallback locally
      if (lang !== 'en' && !translationsCache['en']) {
        await loadLanguage('en');
      }
    }
  };

  useEffect(() => {
    const initI18n = async () => {
      const savedLanguage = readSavedLanguage();
      const targetLang = savedLanguage && isValidLanguage(savedLanguage) ? savedLanguage : 'en';

      // Load both target and English (for fallback) in parallel
      await Promise.all([
        loadLanguage(targetLang),
        targetLang !== 'en' ? loadLanguage('en') : Promise.resolve(),
      ]);

      setLanguageState(targetLang);
    };
    // The app renders nothing until this finishes, so it always finishes: whatever fails,
    // the page shows in English rather than staying blank.
    void initI18n()
      .catch(error => console.error('[i18n] Could not start with the saved language:', error))
      .finally(() => setIsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = async (lang: Language) => {
    // The current language stays on screen until the new one has loaded.
    await loadLanguage(lang);
    setLanguageState(lang);
    // Blocked storage: the choice holds for this visit only.
    safeStorage.set('preferred_language', lang);
    setIsLoaded(true);
  };

  const t = (
    key: string,
    options?: string | ({ defaultValue?: string } & Record<string, unknown>),
    params?: Record<string, unknown>
  ): string => {
    const defaultVal = typeof options === 'string' ? options : options?.defaultValue;
    if (!isLoaded) return defaultVal || key;

    const raw = resolveTranslation(key, language, translationsCache);
    if (!raw) {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation: key="${key}" lang="${language}"`);
      }
      return defaultVal || key;
    }

    const interpolationParams = typeof options === 'object' && options !== null ? options : params;
    return interpolationParams ? interpolate(raw, interpolationParams) : raw;
  };

  // Set during render, not in an effect, so the screen rendered for a new language
  // already formats its dates and numbers in it.
  setAppLanguage(language);
  const isRTL = RTL_LANGUAGES.includes(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [language, isRTL]);

  // Screen text comes from the locale file; until it has loaded there is nothing
  // to show but raw keys, so render nothing (index.html preloads en.json).
  if (!isLoaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use language context
// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Helper function to validate language code
const isValidLanguage = (code: string): boolean => {
  const validLanguages: Language[] = [
    'en',
    'es',
    'sw',
    'fr',
    'de',
    'pt',
    'it',
    'nl',
    'da',
    'pl',
    'hu',
    'tr',
    'ar',
    'zh',
    'hi',
    'ru',
    'uk',
    'ro',
    'cs',
    'sk',
    'bg',
    'el',
    'ug',
    'zu',
    'ha',
    'yo',
    'ig',
    'am',
    'om',
    'ny',
    'lg',
    'rw',
    'so',
    'bn',
    'id',
    'vi',
    'ur',
  ];
  return validLanguages.includes(code as Language);
};

export default LanguageContext;
