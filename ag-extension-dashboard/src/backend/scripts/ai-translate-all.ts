import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from backend .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const I18N_FILE = '/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/lib/i18n.ts';

// Configuration - uses Groq by default, but can switch to Ollama
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Groq setup (if using Groq)
let groq: any = null;
if (!USE_OLLAMA && (!GROQ_API_KEY || GROQ_API_KEY === 'your-groq-api-key')) {
    console.error('❌ Error: Valid GROQ_API_KEY not found and USE_OLLAMA is not enabled.');
    console.error('Please either:');
    console.error('  1. Set GROQ_API_KEY in src/backend/.env');
    console.error('  2. Set USE_OLLAMA=true and configure OLLAMA_BASE_URL/OLLAMA_MODEL');
    process.exit(1);
}

if (GROQ_API_KEY && GROQ_API_KEY !== 'your-groq-api-key') {
    // Dynamic import Groq only when needed
    const Groq = require('groq-sdk');
    groq = new Groq({ apiKey: GROQ_API_KEY });
}

async function translateWithOllama(keys: Record<string, string>, targetLang: string): Promise<Record<string, string>> {
    const prompt = `
You are a professional translator for an Agricultural Extension platform called "Ag-Extension". 
Your goal is to translate the following dashboard labels and messages into ${targetLang}.

SPECIAL INSTRUCTIONS FOR SCRIPTS:
- For Uyghur (ug): NEVER use Latin script. ALWAYS use the standard Arabic-based script (Kona Yeziq).
- For Hindi (hi): Use the Devanagari script.
- For Arabic (ar): Use the Arabic script.
- For all other languages: Use the standard script for that language.
CONTEXT:
- The platform is used by agricultural extension officers and farmers.
- Terminology should be professional yet accessible to rural agricultural workers.
- Maintain placeholders like {name}, {date}, {price}, {amount}, {currency}, {count} exactly as they are.
- Keep the keys exactly as they are.
- Respond ONLY with a valid JSON object.

English Labels:
${JSON.stringify(keys, null, 2)}
`;

    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: 'You are a professional agricultural translator. Return ONLY valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                stream: false,
                format: 'json'
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        const aiDict = JSON.parse(data.message?.content || '{}');

        // Filter aiDict keys to only include those present in the original 'keys' batch
        const validKeys = new Set(Object.keys(keys));
        const filteredAiDict: Record<string, string> = {};
        for(const [k, v] of Object.entries(aiDict)) {
            if (validKeys.has(k)) {
                filteredAiDict[k] = String(v);
            }
        }
        return filteredAiDict;
    } catch (error) {
        console.error(`  Error translating to ${targetLang} with Ollama:`, error);
        return {};
    }
}

async function translateBatch(keys: Record<string, string>, targetLang: string, retries = 3, temperature = 0.2): Promise<Record<string, string>> {
    const model = targetLang === 'Uyghur' ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";
    
    const prompt = `Translate the following English strings into ${targetLang}.
Return ONLY a JSON object mapping keys to translations.
Keep translations concise. Do NOT add extra keys or metadata.

SPECIAL INSTRUCTIONS:
${targetLang === 'Uyghur' ? '- ALWAYS use the standard Arabic-based script (Kona Yeziq). NEVER use Latin or Cyrillic.' : 
targetLang === 'Hindi' ? '- Use the Devanagari script.' : 
targetLang === 'Arabic' ? '- Use the Arabic script.' : 
'- Use the standard script for this language.'}

Input JSON:
${JSON.stringify(keys, null, 2)}
`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const completion = await groq.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: `You are a professional agricultural translator for ${targetLang}. Return ONLY valid JSON.` },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: temperature,
                max_completion_tokens: 4096,
            });

            const rawContent = completion.choices[0].message.content || '{}';
            const aiDict = JSON.parse(rawContent);
            
            // Filter: Only accept keys present in the original batch
            const filteredResult: Record<string, string> = {};
            for (const key of Object.keys(keys)) {
                if (aiDict[key]) {
                    filteredResult[key] = String(aiDict[key]);
                }
            }
            return filteredResult;
        } catch (error: any) {
            if (error.status === 429 && attempt < retries) {
                const retryAfter = parseInt(error.headers?.['retry-after'] || '5');
                const waitTime = (retryAfter + Math.pow(2, attempt)) * 1000;
                console.warn(`  ⚠️ Rate limit hit. Retrying in ${waitTime/1000}s... (Attempt ${attempt + 1}/${retries})`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            console.error(`  Error translating to ${targetLang}:`, error);
            return {};
        }
    }
    return {};
}

function saveToFile(finalTranslations: Record<string, Record<string, string>>, originalContent: string) {
    let newContent = originalContent.split('export const translations: Record<Language, Record<string, string>> = {')[0];
    newContent += 'export const translations: Record<Language, Record<string, string>> = {\n';

    const sortedLangs = Object.keys(finalTranslations).sort();

    for (const lang of sortedLangs) {
        newContent += `    ${lang}: {\n`;
        const dict = finalTranslations[lang];
        const sortedKeys = Object.keys(dict).sort();

        for (const key of sortedKeys) {
            const value = String(dict[key] || '').replace(/"/g, '\\"');
            newContent += `        ${key}: "${value}",\n`;
        }
        newContent += `    },\n`;
    }

    newContent += '};\n';
    fs.writeFileSync(I18N_FILE, newContent);
}

async function run() {
    console.log('🚀 Starting AI Multilingual Translation...');

    if (USE_OLLAMA) {
        console.log(`📡 Using Ollama: ${OLLAMA_BASE_URL} with model: ${OLLAMA_MODEL}`);
    } else {
        console.log('📡 Using Groq API (llama-3.1-8b-instant)');
    }

    if (!fs.existsSync(I18N_FILE)) {
        console.error(`❌ i18n file not found at ${I18N_FILE}`);
        return;
    }

    const content = fs.readFileSync(I18N_FILE, 'utf8');

    // Extract languages and English dictionary
    const langNames: Record<string, string> = {};
    const langMatches = content.matchAll(/{ code: '(\w+)', name: '([^']+)', flag: '[^']+' }/g);
    for (const match of langMatches) {
        langNames[match[1]] = match[2];
    }

    // Extract English dictionary
    const enMatch = content.match(/en: {([\s\S]*?)},/);
    if (!enMatch) {
        console.error('❌ Could not find English translations in i18n.ts');
        return;
    }

    const enRaw = enMatch[1];
    const enDict: Record<string, string> = {};
    const enKeyMatches = enRaw.matchAll(/(\w+):\s*["']([\s\S]*?)["'],?/g);
    for (const match of enKeyMatches) {
        enDict[match[1]] = match[2];
    }

    console.log(`Found ${Object.keys(enDict).length} keys in English source.`);

    // Extract existing translations for each language to preserve them
    const existingTranslations: Record<string, Record<string, string>> = {};
    const transBlockMatch = content.match(/export const translations: Record<Language, Record<string, string>> = {([\s\S]*?)};/);
    if (transBlockMatch) {
        const transTableRaw = transBlockMatch[1];
        const langBlocks = transTableRaw.matchAll(/(\w+): {([\s\S]*?)},/g);
        for (const block of langBlocks) {
            const langCode = block[1];
            const dictRaw = block[2];
            const dict: Record<string, string> = {};
            const keyMatches = dictRaw.matchAll(/(\w+):\s*["']([\s\S]*?)["'],?/g);
            for (const km of keyMatches) {
                dict[km[1]] = km[2];
            }
            existingTranslations[langCode] = dict;
        }
    }

    const languages = Object.keys(langNames).filter(l => l !== 'en');
    const finalTranslations: Record<string, Record<string, string>> = { 
        en: enDict,
        ...existingTranslations 
    };

    for (const lang of languages) {
        console.log(`\n🌍 Checking translations for ${langNames[lang]} (${lang})...`);

        const currentDict = finalTranslations[lang] || {};
        const keysToTranslate: string[] = [];

        for (const key of Object.keys(enDict)) {
            const existingValue = currentDict[key];
            const universalTerms = ['AI', 'SMS', 'GPS', 'ID', 'PayPal', 'Stripe', 'P2P', '90kg', 'mm'];
            const isUniversal = universalTerms.includes(enDict[key]) || enDict[key].length < 3;

            // SPECIAL CASE: For Uyghur, if existing value contains Latin letters, it's the wrong script.
            const isWrongScript = lang === 'ug' && existingValue && /[a-zA-Z]/.test(existingValue) && !isUniversal;

            if (!existingValue || (existingValue === enDict[key] && !isUniversal) || isWrongScript) {
                keysToTranslate.push(key);
            }
        }

        if (keysToTranslate.length === 0) {
            console.log(`  ✨ Everything already translated for ${lang}!`);
            continue;
        }

        console.log(`  🔄 Found ${keysToTranslate.length} keys to translate/update.`);

        const batchSize = lang === 'ug' ? 1 : 2;
        const temperature = 0.4;
        const newTranslations: Record<string, string> = {};

        for (let i = 0; i < keysToTranslate.length; i += batchSize) {
            const batchKeys = keysToTranslate.slice(i, i + batchSize);
            const batchToTranslate: Record<string, string> = {};
            batchKeys.forEach(k => batchToTranslate[k] = enDict[k]);

            console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keysToTranslate.length / batchSize)}...`);
            const batchResult = await translateBatch(batchToTranslate, langNames[lang], 3, temperature);
            
            // Critical filter: Only accept keys that were actually requested
            const filteredResult: Record<string, string> = {};
            for (const key of batchKeys) {
                if (batchResult[key]) {
                    filteredResult[key] = batchResult[key];
                }
            }

            Object.assign(newTranslations, filteredResult);

            // Incremental save after each batch to avoid data loss
            finalTranslations[lang] = { ...currentDict, ...newTranslations };
            saveToFile(finalTranslations, content);
            console.log(`  💾 Batch progress saved to i18n.ts`);

            await new Promise(r => setTimeout(r, USE_OLLAMA ? 200 : 12000));
        }

        console.log(`  ✅ Done! Updated ${Object.keys(newTranslations).length} keys for ${langNames[lang]}.`);
    }

    console.log('\n✨ i18n.ts has been updated with real translations!');
}

run().catch(console.error);
