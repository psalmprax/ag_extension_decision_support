/**
 * Quick Translation Script using Google Translate
 * Run: npx tsx src/utils/translateAll.ts
 * 
 * Translates all missing languages using Google Translate API
 */

import { translate } from '@vitalets/google-translate-api';
import { sourceTexts, languages } from './translationSource';

async function translateAll() {
    console.log('🚀 Starting translations...\n');

    const allTranslations: Record<string, Record<string, string>> = {};

    // Add English
    allTranslations['en'] = sourceTexts;

    for (const lang of languages) {
        console.log(`Translating to ${lang.name}...`);
        const translations: Record<string, string> = {};

        const keys = Object.keys(sourceTexts);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const text = sourceTexts[key as keyof typeof sourceTexts];

            try {
                const result = await translate(text, { to: lang.code });
                translations[key] = result.text;
                console.log(`  ${key}: ${text} -> ${result.text}`);
            } catch (err) {
                console.error(`  Error translating ${key}:`, err);
                translations[key] = text;
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 200));
        }

        allTranslations[lang.code === 'zh-CN' ? 'zh' : lang.code] = translations;
        console.log(`✅ ${lang.name}: ${Object.keys(translations).length} translations\n`);
    }

    // Output final JSON
    console.log('\n📝 FINAL TRANSLATIONS JSON:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(allTranslations, null, 2));
}

translateAll().catch(console.error);
