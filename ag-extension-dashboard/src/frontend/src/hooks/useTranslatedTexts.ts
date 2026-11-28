import { useEffect, useMemo, useState } from 'react';
import { translateContent } from '@/api/knowledgeService';
import { useLanguage } from '@/lib/LanguageContext';

/** One numbered line per text, so a single (server-cached) request translates them all. */
export function asNumberedList(texts: string[]): string {
  return texts.map((text, index) => `${index + 1}. ${text.replace(/\s*\n+\s*/g, ' ').trim()}`).join('\n');
}

/**
 * The texts back from a translated numbered list, or null unless every number came back exactly
 * once and every line is a numbered one: text on an unnumbered line (a wrapped item, a note
 * from the model) cannot be placed, so the English is shown rather than a shortened item.
 */
export function fromNumberedList(translated: string, count: number): string[] | null {
  const found: string[] = new Array(count);
  let seen = 0;
  for (const line of translated.split('\n')) {
    if (!line.trim()) continue;
    const match = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
    if (!match) return null;
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= count || found[index] !== undefined) return null;
    found[index] = match[2].trim();
    seen += 1;
  }
  return seen === count ? found : null;
}

export interface TranslatedTexts {
  /** The texts to show: translated, or the originals while waiting, on failure, or when asked. */
  texts: string[];
  /** A translation is available (whether or not it is being shown). */
  translated: boolean;
  pending: boolean;
  failed: boolean;
  showOriginal: boolean;
  setShowOriginal: (show: boolean) => void;
}

/**
 * Generated text (diagnoses, guidance) in the language the person reads the app in.
 * Nothing is sent when the app is in the texts' own language. The originals stay
 * available, because product names and doses must be checked against them.
 */
export function useTranslatedTexts(texts: string[], sourceLanguage = 'en'): TranslatedTexts {
  const { language } = useLanguage();
  const key = useMemo(() => JSON.stringify(texts), [texts]);
  const [result, setResult] = useState<{ key: string; language: string; texts: string[] | null } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const needed = texts.some(text => text.trim()) && language.split('-')[0] !== sourceLanguage;

  useEffect(() => {
    if (!needed) return;
    let current = true;
    const originals = JSON.parse(key) as string[];
    translateContent(asNumberedList(originals), language, sourceLanguage)
      .then(response => {
        const back = response.success ? fromNumberedList(response.data.translatedText, originals.length) : null;
        if (current) setResult({ key, language, texts: back });
      })
      .catch((error: unknown) => {
        console.warn('Translation unavailable; showing the original text', error);
        if (current) setResult({ key, language, texts: null });
      });
    return () => {
      current = false;
    };
  }, [key, language, needed, sourceLanguage]);

  const settled = needed && result?.key === key && result.language === language ? result : null;
  const translation = settled?.texts ?? null;
  return {
    texts: translation && !showOriginal ? translation : texts,
    translated: Boolean(translation),
    pending: needed && !settled,
    failed: Boolean(settled) && !translation,
    showOriginal,
    setShowOriginal,
  };
}
