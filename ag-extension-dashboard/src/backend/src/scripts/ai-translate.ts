import fs from 'fs';
import path from 'path';
import { AIProviderFactory, AIRouter } from '../services/aiProvider/aiProvider';

const I18N_FILE = path.resolve(__dirname, '../../../../src/frontend/src/lib/i18n.ts');

function parseTranslations(content: string, startIdx: number, startMarker: string, endIdx: number) {
    const dictText = content.substring(startIdx + startMarker.length, endIdx);
    const sourceDict: Record<string, Record<string, string>> = {};
    const langStartRegex = /^\s*(\w+):\s*\{/gm;
    let langMatch;
    const langStarts: { code: string; start: number; contentStart: number }[] = [];
    while ((langMatch = langStartRegex.exec(dictText)) !== null) {
        langStarts.push({ code: langMatch[1], start: langMatch.index, contentStart: langMatch.index + langMatch[0].length });
    }

    langStarts.forEach((lang, i) => {
        const nextStart = langStarts[i + 1]?.start || dictText.length;
        const blockContent = dictText.substring(lang.contentStart, nextStart);
        const lastBrace = blockContent.lastIndexOf('}');
        const inner = blockContent.substring(0, lastBrace);
        
        const keys: Record<string, string> = {};
        const pairRegex = /^\s*(\w+):\s*"((?:[^"\\]|\\.)*)"/gm;
        let pairMatch;
        while ((pairMatch = pairRegex.exec(inner)) !== null) {
            keys[pairMatch[1]] = pairMatch[2];
        }
        sourceDict[lang.code] = keys;
    });
    return sourceDict;
}

function ensureEnglishHasAllKeys(sourceDict: Record<string, Record<string, string>>, allKeys: Set<string>) {
    const englishKeys = Object.keys(sourceDict['en'] || {});
    const missingInEnglish = [...allKeys].filter(k => !englishKeys.includes(k));
    if (missingInEnglish.length > 0) {
        console.log(`⚠️ Backfilling ${missingInEnglish.length} keys to English...`);
        if (!sourceDict['en']) sourceDict['en'] = {};
        missingInEnglish.forEach(k => {
            const otherVal = Object.values(sourceDict).find(d => d[k])?.[k] || k;
            sourceDict['en'][k] = otherVal;
        });
    }
}

async function translateMissingKeys(sourceDict: Record<string, Record<string, string>>, allKeys: Set<string>) {
    const targetKeys = Array.from(allKeys).sort();
    const languages = Object.keys(sourceDict).filter(l => l !== 'en');
    
    for (const lang of languages) {
        const missing = targetKeys.filter(k => !sourceDict[lang][k]);
        if (missing.length === 0) continue;

        console.log(`🌐 [${lang}] Processing ${missing.length} missing keys...`);
        
        // Always backfill with English FIRST so we have 100% coverage even if AI fails
        missing.forEach(k => {
            sourceDict[lang][k] = sourceDict['en'][k];
        });

        // Try AI translation in chunks
        const chunkSize = 15;
        for (let i = 0; i < missing.length; i += chunkSize) {
            const chunk = missing.slice(i, i + chunkSize);
            const batch: Record<string, string> = {};
            chunk.forEach(k => { batch[k] = sourceDict['en'][k]; });

            try {
                const result = await AIRouter.routeRequest('generate', { 
                    prompt: `Translate to ${lang}: ${JSON.stringify(batch)}. Return ONLY JSON.`, 
                    options: { temperature: 0.1 } 
                });
                const jsonText = result.text.match(/\{[\s\S]*\}/)?.[0] || result.text;
                Object.assign(sourceDict[lang], JSON.parse(jsonText));
                console.log(`   - AI Chunk ${Math.ceil((i+1)/chunkSize)} success`);
            } catch (err) {
                console.warn(`   ⚠️ AI failed for chunk (using English fallbacks)`);
                break; // Stop trying AI for this language if it's failing
            }
        }
    }
}

function saveTranslations(sourceDict: Record<string, Record<string, string>>, header: string, OUTPUT_FILE: string) {
    let newDict = '\n';
    Object.keys(sourceDict).sort().forEach(lang => {
        newDict += `    ${lang}: {\n`;
        Object.keys(sourceDict[lang]).sort().forEach(key => {
            newDict += `        ${key}: "${sourceDict[lang][key].replace(/"/g, '\\"')}",\n`;
        });
        newDict += `    },\n`;
    });

    fs.writeFileSync(OUTPUT_FILE, header + newDict + '};\n');
    console.log('✨ 100% Coverage Achieved (with English fallbacks where AI failed).');
}

async function main() {
    console.log('🚀 Starting Super Auto-Translation...');
    AIProviderFactory.initialize();

    if (!fs.existsSync(I18N_FILE)) {
        console.error('❌ i18n file not found');
        process.exit(1);
    }

    const content = fs.readFileSync(I18N_FILE, 'utf8');
    
    // Extract translations object
    const startMarker = 'export const translations: Record<Language, Record<string, string>> = {';
    const endMarker = '};';
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.lastIndexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) {
        console.error('❌ Could not parse translations object');
        process.exit(1);
    }

    const header = content.substring(0, startIdx + startMarker.length);
    const sourceDict = parseTranslations(content, startIdx, startMarker, endIdx);

    const allKeys = new Set<string>();
    Object.values(sourceDict).forEach(dict => Object.keys(dict).forEach(k => allKeys.add(k)));
    console.log(`📊 Total unique keys: ${allKeys.size}`);

    ensureEnglishHasAllKeys(sourceDict, allKeys);
    await translateMissingKeys(sourceDict, allKeys);
    saveTranslations(sourceDict, header, I18N_FILE);
}

main().catch(console.error);
