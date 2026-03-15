const fs = require('fs');
const path = require('path');

const i18nPath = path.resolve(__dirname, '../src/frontend/src/lib/i18n.ts');

function validateTranslations() {
    console.log('🔍 Starting robust translation validation...');
    
    if (!fs.existsSync(i18nPath)) {
        console.error(`❌ File not found: ${i18nPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(i18nPath, 'utf8');
    
    // 1. Get the list of expected languages from the Language type definition
    const languageTypeMatch = content.match(/export type Language =\s*([\s\S]*?);/);
    if (!languageTypeMatch) {
        console.error('❌ Could not find Language type definition');
        process.exit(1);
    }
    
    const expectedLanguages = languageTypeMatch[1]
        .split('|')
        .map(l => l.trim().replace(/'/g, ''))
        .filter(l => l.length > 0);
    
    console.log(`📋 Expected languages (${expectedLanguages.length}): ${expectedLanguages.join(', ')}`);

    // 2. Extract the translations object
    const translationsMatch = content.match(/export const translations: Record<Language, Record<string, string>> = ({[\s\S]*?});\s*$/m) || 
                             content.match(/export const translations: Record<Language, Record<string, string>> = ({[\s\S]*?});/);
    
    if (!translationsMatch) {
        console.error('❌ Could not find translations object');
        process.exit(1);
    }

    const translationsBody = translationsMatch[1];
    
    // 3. Extract languages present in translations object
    const languages = {};
    expectedLanguages.forEach(lang => {
        // Look for "lang: {" with varying indentation
        const langRegex = new RegExp(`^\\s*${lang}: \\{([\\s\\S]*?)\\},`, 'm');
        const match = translationsBody.match(langRegex);
        
        if (match) {
            const blockContent = match[1];
            // Match "key: \"value\"," or "key: 'value'," or "key: `value`,"
            const keyMatches = blockContent.match(/^\s*(\w+):/gm);
            if (keyMatches) {
                languages[lang] = new Set(keyMatches.map(k => k.trim().replace(':', '')));
            } else {
                languages[lang] = new Set();
            }
        } else {
            languages[lang] = null; // Missing entirely
        }
    });

    const englishKeys = languages['en'];
    if (!englishKeys) {
        console.error('❌ English [en] keys not found in translations object');
        process.exit(1);
    }

    console.log(`✅ Found ${englishKeys.size} base keys in English`);
    console.log('-----------------------------------');

    let totalMissing = 0;
    let missingLangsCount = 0;

    expectedLanguages.forEach(lang => {
        if (lang === 'en') return;

        const langKeys = languages[lang];
        
        if (langKeys === null) {
            console.error(`❌ Language [${lang}] is MISSING ENTIRELY from translations object`);
            missingLangsCount++;
            return;
        }

        const missingKeys = [...englishKeys].filter(key => !langKeys.has(key));
        if (missingKeys.length > 0) {
            console.error(`❌ Language [${lang}] is missing ${missingKeys.length} keys:`);
            console.error(`   ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
            totalMissing += missingKeys.length;
        } else {
            console.log(`✅ Language [${lang}] is fully in sync.`);
        }
    });

    console.log('-----------------------------------');
    if (totalMissing === 0 && missingLangsCount === 0) {
        console.log('✨ All translations are perfect! ✨');
    } else {
        console.error(`Summary: ${missingLangsCount} languages missing, ${totalMissing} total missing keys.`);
        process.exit(1);
    }
}

validateTranslations();
