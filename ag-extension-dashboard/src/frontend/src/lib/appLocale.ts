/**
 * The locale for dates and numbers: the language the person chose in the app, not the
 * phone's own setting, so a German screen says "2. März 2023" and a French one "2 mars 2023".
 * LanguageContext keeps it current; formatting outside React (chart helpers, services)
 * reads it here.
 */
let language = 'en';

/** Called by LanguageContext whenever the app language changes. */
export function setAppLanguage(next: string): void {
  language = next || 'en';
}

/** The language code the person chose in the app ('en', 'fr', 'ha', ...). */
export function appLanguage(): string {
  return language;
}

function supported(tag: string): boolean {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0;
  } catch {
    return false;
  }
}

/**
 * A BCP 47 tag for Intl. English follows the phone's English variant (en-KE, en-NG, en-US);
 * a language the browser has no date data for falls back to day-month English.
 */
export function appLocale(): string {
  if (language === 'en') {
    const device = typeof navigator !== 'undefined' ? navigator.language : '';
    return device.startsWith('en') ? device : 'en-GB';
  }
  const tag = language === 'zh' ? 'zh-CN' : language;
  return supported(tag) ? tag : 'en-GB';
}

/** "2 Mar 2023" in the app language. */
export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(appLocale(), options).format(date);
}

/** "2 Mar 2023, 14:05" in the app language. */
export function formatDateTime(value: string | number | Date): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}
