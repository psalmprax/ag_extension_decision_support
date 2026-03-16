import fs from 'fs';


const fileContent = fs.readFileSync('src/frontend/src/lib/i18n.ts', 'utf8');

function extractTranslations(content: string) {
    const translationsMatch = content.match(/export const translations: Record<Language, Record<string, string>> = \{([\s\S]*?)\};/);
    if (!translationsMatch) return null;
    
    const dicts: Record<string, Record<string, string>> = {};
    const dictRegex = /([a-z]{2}): \{([\s\S]*?)\}/g;
    let match;
    while ((match = dictRegex.exec(translationsMatch[1])) !== null) {
        const lang = match[1];
        const keysText = match[2];
        const keys: Record<string, string> = {};
        const keyRegex = /([a-z0-9_]+): "(.*?)"/g;
        let keyMatch;
        while ((keyMatch = keyRegex.exec(keysText)) !== null) {
            keys[keyMatch[1]] = keyMatch[2];
        }
        dicts[lang] = keys;
    }
    return dicts;
}

const dictionaries = extractTranslations(fileContent);
if (!dictionaries) {
    console.error('❌ Could not find translations object');
    process.exit(1);
}

const enKeys = Object.keys(dictionaries['en'] || {});
const VALID_LANGS = ['sw', 'fr', 'pt', 'es', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el', 'ug'];

console.log(`📊 Auditing ${VALID_LANGS.length} languages against 'en' (${enKeys.length} keys)...`);

let complete = true;
VALID_LANGS.forEach(lang => {
    const dict = dictionaries[lang];
    if (!dict) {
        console.error(`❌ Language ${lang} is MISSING from translations!`);
        complete = false;
        return;
    }
    
    const missingKeys = enKeys.filter(k => !dict[k]);
    if (missingKeys.length > 0) {
        console.error(`❌ Language ${lang} is missing ${missingKeys.length} keys!`);
        // console.log(`   Missing: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
        complete = false;
    } else {
        console.log(`✅ Language ${lang} is 100% complete.`);
    }
});

if (complete) {
    console.log('\n🎉 ALL LANGUAGES 100% SYNCHRONIZED!');
    process.exit(0);
} else {
    console.error('\n⚠️  SOME LANGUAGES HAVE MISSING KEYS.');
    process.exit(1);
}
