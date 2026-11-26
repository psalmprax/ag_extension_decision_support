/**
 * The languages the speech-to-text models (whisper.cpp, OpenAI's Whisper and
 * gpt-4o-transcribe) were trained on, by ISO 639-1 code. A code outside this list
 * is rejected by the speech APIs, so those recordings are sent with no language
 * and the model detects it, which is often wrong for languages it was not trained on.
 */
const TRANSCRIBER_LANGUAGES = new Set([
  'af', 'am', 'ar', 'as', 'az', 'ba', 'be', 'bg', 'bn', 'bo', 'br', 'bs', 'ca', 'cs', 'cy',
  'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi', 'fo', 'fr', 'gl', 'gu', 'ha', 'he',
  'hi', 'hr', 'ht', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'jw', 'ka', 'kk', 'km', 'kn', 'ko',
  'la', 'lb', 'ln', 'lo', 'lt', 'lv', 'mg', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
  'ne', 'nl', 'nn', 'no', 'oc', 'pa', 'pl', 'ps', 'pt', 'ro', 'ru', 'sa', 'sd', 'si', 'sk',
  'sl', 'sn', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'tk', 'tl', 'tr',
  'tt', 'uk', 'ur', 'uz', 'vi', 'yi', 'yo', 'zh',
]);

export interface SpeechLanguage {
  /** The code to send to the transcriber, or 'auto' to let it detect the language. */
  code: string;
  /** False when the user's language is not one the transcriber was trained on. */
  supported: boolean;
}

/** Maps a language hint such as 'ha', 'sw-KE' or 'auto' to what the transcriber accepts. */
export function speechLanguageFor(hint: string): SpeechLanguage {
  const code = hint.trim().toLowerCase().split(/[-_]/)[0];
  if (code === 'auto') return { code: 'auto', supported: true };
  return TRANSCRIBER_LANGUAGES.has(code) ? { code, supported: true } : { code: 'auto', supported: false };
}
