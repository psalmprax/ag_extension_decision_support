const fs = require('fs');
const path = require('path');

const I18N_FILE = path.join(__dirname, '../src/frontend/src/lib/i18n.ts');

const VALID_LANGS = new Set(['en', 'sw', 'fr', 'pt', 'es', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el', 'ug']);

function extractTranslations(content) {
    const translations = {};
    const translationsMatch = content.match(/export const translations: Record<Language, Record<string, string>> = \{([\s\S]*)\};\s*$/);
    if (!translationsMatch) return {};
    const translationsBody = translationsMatch[1];
    const langPattern = /^\s*([a-z]{2}):\s*\{/gm;
    let match;
    const languages = [];
    while ((match = langPattern.exec(translationsBody)) !== null) {
        if (VALID_LANGS.has(match[1])) {
            languages.push({ code: match[1], start: match.index });
        }
    }
    languages.sort((a, b) => a.start - b.start);
    for (let i = 0; i < languages.length; i++) {
        const lang = languages[i].code;
        const start = languages[i].start;
        const end = (i < languages.length - 1) ? languages[i + 1].start : translationsBody.length;
        const block = translationsBody.substring(start, end);
        const keys = {};
        const keyPattern = /([a-z_][a-z_0-9]*):\s*(["'])(.*?)\2/g;
        let keyMatch;
        while ((keyMatch = keyPattern.exec(block)) !== null) {
            keys[keyMatch[1]] = keyMatch[3];
        }
        translations[lang] = keys;
    }
    return translations;
}

const UNIVERSAL_TERMS = new Set(['SMS', 'AI', 'PDF', 'GPS', 'ID', 'KES', 'USD', 'MWK']);

function verify() {
    console.log('🔍 Auditing translations for English fallbacks...\n');
    
    if (!fs.existsSync(I18N_FILE)) {
        console.error('❌ i18n.ts not found.');
        return;
    }

    const content = fs.readFileSync(I18N_FILE, 'utf8');
    const translations = extractTranslations(content);
    const enDict = translations['en'];
    
    if (!enDict) {
        console.error('❌ English dictionary not found.');
        return;
    }

    const languages = Object.keys(translations).filter(l => l !== 'en');
    const enKeys = Object.keys(enDict);

    let totalIssues = 0;
    const report = {};

    languages.forEach(lang => {
        const dict = translations[lang];
        const fallbacks = [];

        enKeys.forEach(key => {
            const val = dict[key];
            const enVal = enDict[key];

            if (!val) {
                fallbacks.push({ key, reason: 'MISSING' });
            } else if (val === enVal) {
                const isUniversal = UNIVERSAL_TERMS.has(enVal.toUpperCase()) || enVal.length < 3;
                if (!isUniversal) {
                    fallbacks.push({ key, reason: 'ENGLISH_FALLBACK', value: val });
                }
            }
        });

        if (fallbacks.length > 0) {
            report[lang] = fallbacks;
            totalIssues += fallbacks.length;
            console.log(`🚩 ${lang}: ${fallbacks.length} issues found`);
        } else {
            console.log(`✅ ${lang}: 100% unique translations`);
        }
    });

    console.log(`\n📊 Audit Complete. Total potential issues: ${totalIssues}`);
    
    if (totalIssues > 0) {
        const reportPath = path.join(__dirname, 'translation-audit-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`Detailed report saved to: ${reportPath}`);
    }
}

verify();
