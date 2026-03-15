import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const groq = new Groq({ apiKey: GROQ_API_KEY });

const I18N_FILE = '/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/lib/i18n.ts';
const OUTPUT_FILE = I18N_FILE;

const VALID_LANGS = new Set(['en', 'sw', 'fr', 'pt', 'es', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el', 'ug']);

// Read the i18n file
const content = fs.readFileSync(I18N_FILE, 'utf8');

// Extract translations object
function extractTranslations(content: string) {
    const translations: Record<string, Record<string, string>> = {};

    // Find the translations object content
    const translationsMatch = content.match(/export const translations: Record<Language, Record<string, string>> = \{([\s\S]*)\};\s*$/);
    if (!translationsMatch) return {};

    const translationsBody = translationsMatch[1];

    // Find all language blocks at the start of lines in the translations object
    const langPattern = /^\s*([a-z]{2}):\s*\{/gm;
    let match;

    const languages: { code: string; start: number }[] = [];
    while ((match = langPattern.exec(translationsBody)) !== null) {
        if (VALID_LANGS.has(match[1])) {
            languages.push({
                code: match[1],
                start: match.index
            });
        }
    }

    // Sort by position
    languages.sort((a, b) => a.start - b.start);

    // Extract each language's keys
    for (let i = 0; i < languages.length; i++) {
        const lang = languages[i].code;
        const start = languages[i].start;
        const end = (i < languages.length - 1) ? languages[i + 1].start : translationsBody.length;

        const block = translationsBody.substring(start, end);
        const keys: Record<string, string> = {};

        // Extract key: "value" pairs - handle escaped quotes
        const keyPattern = /([a-z_][a-z_0-9]*):\s*(["'])(.*?)\2/g;
        let keyMatch;

        while ((keyMatch = keyPattern.exec(block)) !== null) {
            keys[keyMatch[1]] = keyMatch[3];
        }

        translations[lang] = keys;
    }

    return translations;
}

const langNames: Record<string, string> = {
    sw: 'Swahili',
    fr: 'French',
    pt: 'Portuguese',
    es: 'Spanish',
    zu: 'Zulu',
    it: 'Italian',
    de: 'German',
    nl: 'Dutch',
    da: 'Danish',
    pl: 'Polish',
    hu: 'Hungarian',
    tr: 'Turkish',
    ar: 'Arabic',
    zh: 'Chinese (Simplified)',
    hi: 'Hindi',
    ru: 'Russian',
    uk: 'Ukrainian',
    ro: 'Romanian',
    cs: 'Czech',
    sk: 'Slovak',
    bg: 'Bulgarian',
    el: 'Greek',
    ug: 'Uyghur'
};

async function aiTranslateDictionary(langCode: string, targetLangName: string, sourceDict: Record<string, string>, currentDict: Record<string, string>) {
    const keysToTranslate = Object.keys(sourceDict).filter(key => {
        const val = currentDict[key];
        const sourceVal = sourceDict[key];
        
        if (!val) return true;
        if (val === sourceVal) {
            const isUniversal = /^(SMS|PDF|AI|ID|GPS|KES|USD|MWK)$/i.test(sourceVal) || sourceVal.length < 3;
            return !isUniversal;
        }
        return false;
    });

    if (keysToTranslate.length === 0) {
        console.log(`  ✨ ${langCode}: No translations needed.`);
        return currentDict;
    }

    console.log(`  🤖 ${langCode}: Translating ${keysToTranslate.length} keys to ${targetLangName}...`);

    const resultDict = { ...currentDict };
    const batchSize = 40;
    
    for (let i = 0; i < keysToTranslate.length; i += batchSize) {
        const batch = keysToTranslate.slice(i, i + batchSize);
        const input: Record<string, string> = {};
        batch.forEach(k => input[k] = sourceDict[k]);

        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are a professional agricultural translator. Translate the following dashboard labels for an Agricultural Extension platform into ${targetLangName}. 
                        
Guidelines:
- Maintain the exact JSON keys.
- Keep placeholders like {name}, {count}, {price}, {date}, {amount}, {currency} exactly as they are.
- Ensure agricultural terminology (e.g., "Extension Officer", "Pest Management", "Soil Health") is accurate and professional in ${targetLangName}.
- Return ONLY a valid JSON object. No preamble or explanation.`
                    },
                    {
                        role: "user",
                        content: JSON.stringify(input, null, 2)
                    }
                ],
                // Fallback to smaller model if needed to save TPD? 
                // llama-3.3-70b-versatile is good, but let's stick to it unless it fails.
                model: "llama-3.1-8b-instant",
                response_format: { type: "json_object" }
            });

            const translatedBatch = JSON.parse(completion.choices[0]?.message?.content || "{}");
            Object.assign(resultDict, translatedBatch);
            console.log(`    ✅ Batch ${Math.floor(i / batchSize) + 1} complete. (${batch.length} keys)`);
        } catch (err: any) {
            if (err?.error?.code === 'rate_limit_exceeded') {
                console.error(`    🔴 Rate limit exceeded. Stopping translations for ${langCode}. Save and resume later.`);
                throw err; // Propagate to stop the whole process
            }
            console.error(`    ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, err);
            batch.forEach(k => { if (!resultDict[k]) resultDict[k] = sourceDict[k]; });
        }
    }

    return resultDict;
}

async function run() {
    console.log('🚀 Starting Refined AI Translation Process...\n');

    const dictionaries = extractTranslations(content);
    const enDict = dictionaries['en'];
    if (!enDict) {
        console.error('❌ Could not find English dictionary (en).');
        return;
    }

    const langCodes = Array.from(VALID_LANGS).filter(l => l !== 'en');
    console.log(`🌍 Processing ${langCodes.length} languages: ${langCodes.join(', ')}`);
    
    let stoppedByRateLimit = false;

    // For each language, perform AI translation
    for (const code of langCodes) {
        const targetName = langNames[code] || code;
        try {
            dictionaries[code] = await aiTranslateDictionary(code, targetName, enDict, dictionaries[code]);
        } catch (err) {
            stoppedByRateLimit = true;
            break;
        }
    }

    // Rebuild the file
    console.log('\n📝 Rebuilding i18n.ts with strict key filtering...');
    
    // Original headers and type definitions
    const headerMatch = content.match(/([\s\S]*export const translations: Record<Language, Record<string, string>> = \{)/);
    if (!headerMatch) {
        console.error('❌ Could not find header in file.');
        return;
    }

    const enKeys = new Set(Object.keys(enDict));
    let output = headerMatch[1] + '\n';

    // Iterate over all VALID_LANGS, ensuring all are present and sorted
    Array.from(VALID_LANGS).sort().forEach(lang => {
        output += `    ${lang}: {\n`;
        const dict = dictionaries[lang] || {}; // Initialize with empty object if language not found
        // Only include keys that exist in English dictionary
        const sortedKeys = Object.keys(dict).filter(k => enKeys.has(k)).sort();
        sortedKeys.forEach(key => {
            const value = dict[key] || "";
            const escapedValue = value.replace(/"/g, '\\"');
            output += `        ${key}: "${escapedValue}",\n`;
        });
        output += `    },\n`;
    });

    output += `};\n`;

    fs.writeFileSync(OUTPUT_FILE, output);
    
    if (stoppedByRateLimit) {
        console.log(`\n⚠️  Process paused due to rate limits. Progress has been saved to i18n.ts.`);
        console.log(`Please run the script again tomorrow to complete the remaining translations.`);
    } else {
        console.log(`\n🎉 Success! i18n.ts has been updated with AI translations.`);
    }
}

run().catch(console.error);
