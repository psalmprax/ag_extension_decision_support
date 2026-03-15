import * as fs from 'fs';
import * as path from 'path';

const I18N_TS_PATH = path.join(__dirname, '../../frontend/src/lib/i18n.ts');
const LOCALES_DIR = path.join(__dirname, '../../frontend/public/locales');

async function extractTranslations() {
    console.log('🚀 Extracting translations to JSON files...');

    if (!fs.existsSync(LOCALES_DIR)) {
        fs.mkdirSync(LOCALES_DIR, { recursive: true });
    }

    const content = fs.readFileSync(I18N_TS_PATH, 'utf8');
    
    // Find the start of the translations object
    const startMarker = 'export const translations: Record<Language, Record<string, string>> = {';
    const startIndex = content.indexOf(startMarker);
    
    if (startIndex === -1) {
        throw new Error('Could not find translations object in i18n.ts');
    }

    // We need to find the closing '};' for the translations object
    // Since the object is large, we'll look for the last '};' before the end of the file
    const lastClosingIndex = content.lastIndexOf('};');
    
    if (lastClosingIndex === -1 || lastClosingIndex < startIndex) {
        throw new Error('Could not find closing bracket for translations object');
    }

    // Extract the object literal content
    const objLiteral = content.substring(startIndex + startMarker.length - 1, lastClosingIndex + 1);

    try {
        // We use a safe-ish way to parse this: 
        // 1. Convert it to a format that JSON.parse might understand OR
        // 2. Use a Function constructor which is slightly safer than eval but similar.
        // We'll use the Function constructor approach for simplicity in this build tool.
        const translations = new Function(`return ${objLiteral}`)();

        const languages = Object.keys(translations);

        for (const lang of languages) {
            const filePath = path.join(LOCALES_DIR, `${lang}.json`);
            const langContent = JSON.stringify(translations[lang], null, 2);
            
            fs.writeFileSync(filePath, langContent);
            console.log(`  ✅ Written ${lang}.json (${(langContent.length / 1024).toFixed(2)} KB)`);
        }

        console.log('\n✨ Extraction complete! Files are in /frontend/public/locales/');
    } catch (err) {
        console.error('Failed to parse translations object:', err);
    }
}

extractTranslations().catch(console.error);
