
import { languages, translations } from './src/lib/i18n';

const enKeys = Object.keys(translations.en);
const results: Record<string, string[]> = {};

Object.keys(translations).forEach(lang => {
    if (lang === 'en') return;
    const langKeys = Object.keys(translations[lang]);
    const missing = enKeys.filter(key => !langKeys.includes(key));
    if (missing.length > 0) {
        results[lang] = missing;
    }
});

console.log(JSON.stringify(results, null, 2));
