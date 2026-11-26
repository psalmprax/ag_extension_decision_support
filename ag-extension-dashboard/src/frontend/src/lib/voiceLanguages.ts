import type { Language } from '@/lib/i18n';
import { SPEECH_LOCALES } from '@/lib/speechLocales';

/**
 * Browser dictation (the Web Speech API) only understands some languages. For the
 * app's languages listed here it gives live text as you speak; every other language
 * (Hausa, Yoruba, Igbo, Kinyarwanda, Amharic, Somali and others) is recorded and
 * transcribed on the server instead. Before this list existed the browser was told
 * to hear those languages as US English, which produced nonsense.
 */
const BROWSER_DICTATES: ReadonlySet<string> = new Set<Language>([
  'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fr', 'hi', 'hu', 'id', 'it',
  'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sw', 'tr', 'uk', 'ur', 'vi', 'zh', 'zu',
]);

/** The browser dictation locale for an app language, or null when the browser cannot dictate it. */
export function browserDictationLocale(language: string): string | null {
  const code = language.trim().toLowerCase().split(/[-_]/)[0];
  return BROWSER_DICTATES.has(code) ? SPEECH_LOCALES[code as Language] : null;
}
