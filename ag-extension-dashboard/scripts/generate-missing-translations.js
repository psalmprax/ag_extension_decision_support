/**
 * i18n Translation Key Generator
 * 
 * This script ensures all languages have the same translation keys as English.
 * It adds missing keys with English fallback values.
 * 
 * Usage: node scripts/generate-missing-translations.js
 */

const fs = require('fs');
const path = require('path');

const I18N_FILE = path.join(__dirname, '../src/frontend/src/lib/i18n.ts');
const OUTPUT_FILE = path.join(__dirname, '../src/frontend/src/lib/i18n-fixed.ts');

// Read the i18n file
const content = fs.readFileSync(I18N_FILE, 'utf8');

// Extract translations object
function extractTranslations(content) {
    const translations = {};

    // Find all language blocks
    const langPattern = /([a-z]{2}):\s*\{/g;
    let match;

    // Get all language codes and their positions
    const languages = [];
    while ((match = langPattern.exec(content)) !== null) {
        languages.push({
            code: match[1],
            start: match.index
        });
    }

    // Sort by position
    languages.sort((a, b) => a.start - b.start);

    // Extract each language's keys
    for (let i = 0; i < languages.length; i++) {
        const lang = languages[i].code;
        const start = languages[i].start;
        const end = (i < languages.length - 1) ? languages[i + 1].start : content.length;

        const block = content.substring(start, end);
        const keys = {};

        // Extract key: "value" pairs
        const keyPattern = /([a-z_][a-z_0-9]*):\s*("([^"\\]|\\.)*")/g;
        let keyMatch;

        while ((keyMatch = keyPattern.exec(block)) !== null) {
            keys[keyMatch[1]] = keyMatch[2];
        }

        translations[lang] = keys;
    }

    return translations;
}

// Main function
function generateMissingTranslations() {
    console.log('📚 Loading i18n translations...\n');

    const translations = extractTranslations(content);
    const englishKeys = Object.keys(translations['en'] || {});
    const languages = Object.keys(translations);

    console.log(`Found ${languages.length} languages`);
    console.log(`English has ${englishKeys.length} keys\n`);

    // Track missing keys per language
    const missingReport = {};
    let totalMissing = 0;

    // Add missing keys to each language
    languages.forEach(lang => {
        if (lang === 'en') return; // Skip English

        const dict = translations[lang];
        const missing = [];

        englishKeys.forEach(key => {
            if (!dict[key]) {
                // Add missing key with English fallback
                dict[key] = translations['en'][key];
                missing.push(key);
            }
        });

        if (missing.length > 0) {
            missingReport[lang] = missing;
            totalMissing += missing.length;
            console.log(`✅ ${lang}: Added ${missing.length} missing keys`);
        }
    });

    console.log(`\n📊 Total missing keys added: ${totalMissing}\n`);

    // Generate the fixed content
    let output = `// Ag Extension Decision Support - Internationalization Configuration
// AUTO-GENERATED FILE - Do not edit manually
// Run: node scripts/generate-missing-translations.js

export type Language =
    | 'en' | 'sw' | 'fr' | 'pt' | 'es' | 'zu'
    | 'it' | 'de' | 'nl' | 'da' | 'pl' | 'hu' | 'tr'
    | 'ar' | 'zh' | 'hi' | 'ru' | 'uk' | 'ro' | 'cs'
    | 'sk' | 'bg' | 'el' | 'ug';

export const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'sw', name: 'Swahili', flag: '🇰🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'zu', name: 'Zulu', flag: '🇿🇦' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'da', name: 'Dansk', flag: '🇩🇰' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦' },
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
    { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
    { code: 'bg', name: 'Български', flag: '🇧🇬' },
    { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
    { code: 'ug', name: 'Uyghur', flag: '🇨🇳' },
];

// Dashboard-specific translations
export const translations: Record<Language, Record<string, string>> = {
`;

    // Add each language's translations
    languages.forEach(lang => {
        output += `    ${lang}: {\n`;

        const dict = translations[lang];
        const keys = Object.keys(dict).sort();

        keys.forEach(key => {
            output += `        ${key}: ${dict[key]},\n`;
        });

        output += `    },\n`;
    });

    output += `};\n`;

    // Write to output file
    fs.writeFileSync(OUTPUT_FILE, output);

    console.log(`✅ Generated fixed translations to: ${OUTPUT_FILE}`);
    console.log(`\nTo apply the fix, run:`);
    console.log(`   mv ${OUTPUT_FILE} ${I18N_FILE}`);

    // Also create a detailed report
    const reportFile = path.join(__dirname, '../src/frontend/src/lib/missing-translations-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(missingReport, null, 2));
    console.log(`📋 Detailed report saved to: ${reportFile}`);
}

// Run
generateMissingTranslations();
