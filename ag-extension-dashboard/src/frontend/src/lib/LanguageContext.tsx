'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language } from './i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (
    key: string,
    options?: string | ({ defaultValue?: string } & Record<string, any>),
    params?: Record<string, any>
  ) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Languages that use Right-to-Left direction
const RTL_LANGUAGES: Language[] = ['ar'];

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
      const savedLanguage = localStorage.getItem('preferred_language') as Language;
      const targetLang = savedLanguage && isValidLanguage(savedLanguage) ? savedLanguage : 'en';

      // Load both target and English (for fallback) in parallel
      await Promise.all([
        loadLanguage(targetLang),
        targetLang !== 'en' ? loadLanguage('en') : Promise.resolve(),
      ]);

      setLanguageState(targetLang);
      setIsLoaded(true);
    };
    initI18n();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = async (lang: Language) => {
    setIsLoaded(false); // Show loading during transition or handle smoothly
    await loadLanguage(lang);
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
    setIsLoaded(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (
    key: string,
    options?: string | ({ defaultValue?: string } & Record<string, any>),
    params?: Record<string, any>
  ): string => {
    const defaultVal = typeof options === 'string' ? options : options?.defaultValue;
    const interpolationParams = typeof options === 'object' && options !== null ? options : params;

    if (!isLoaded) return defaultVal || key;

    const langTranslations = translationsCache[language];
    const englishTranslations = translationsCache['en'];

    // Get translation for current language
    const translation = langTranslations?.[key];

    let result = translation;

    if (!translation) {
      // Log missing key in development mode
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation: key="${key}" lang="${language}"`);
      }

      // Fallback to English
      const englishFallback = englishTranslations?.[key];
      if (englishFallback) {
        result = englishFallback;
      } else {
        // Fallback to provided default value or key
        return defaultVal || key;
      }
    }

    // Handle string interpolation
    if (interpolationParams) {
      Object.keys(interpolationParams).forEach(optKey => {
        if (optKey !== 'defaultValue') {
          result = result.replace(new RegExp(`\\{${optKey}\\}`, 'g'), String(interpolationParams[optKey]));
        }
      });
    }

    return result;
  };

  const isRTL = RTL_LANGUAGES.includes(language);

  // Provide a default value during loading
  if (!isLoaded) {
    return (
      <LanguageContext.Provider
        value={{
          language: 'en',
          setLanguage: () => {},
          t: (key: string) => key,
          isRTL: false,
        }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

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
  ];
  return validLanguages.includes(code as Language);
};

export default LanguageContext;
