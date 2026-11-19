import en from '../../public/locales/en.json';
import { interpolate } from '@/lib/interpolate';

type TOptions = string | ({ defaultValue?: string } & Record<string, unknown>);
const english = en as Record<string, string>;

/** The English `t()` the app renders, for tests that render without a LanguageProvider. */
export function englishT(key: string, options?: TOptions, params?: Record<string, unknown>): string {
  const fallback = typeof options === 'string' ? options : options?.defaultValue;
  const raw = english[key] ?? fallback ?? key;
  const values = typeof options === 'object' && options !== null ? options : params;
  return values ? interpolate(raw, values) : raw;
}
