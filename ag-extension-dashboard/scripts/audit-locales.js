const fs = require('node:fs');
const path = require('node:path');

const localesDir = path.join(__dirname, '../src/frontend/public/locales');
const enPath = path.join(localesDir, 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = Object.keys(enData);

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

console.log(`Auditing ${files.length} language files against en.json (${enKeys.length} keys)...`);

let hasErrors = false;
const universalValues = new Set(['AI', 'API', 'GPS', 'ID', 'PDF', 'SMS', 'USD', 'KES', 'MWK']);

files.forEach(file => {
    const lang = file.replace('.json', '');
    const filePath = path.join(localesDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const keys = Object.keys(data);
        const missing = enKeys.filter(k => !keys.includes(k));
        const extra = keys.filter(k => !enKeys.includes(k));
        
        if (missing.length > 0) {
            console.log(`❌ ${lang} is missing ${missing.length} keys.`);
            hasErrors = true;
        }
        if (extra.length > 0) {
            console.log(`⚠️ ${lang} has ${extra.length} extra keys not in en.json.`);
        }
        const untranslated = enKeys.filter(key => {
            const value = data[key];
            const englishValue = enData[key];
            if (!value) return false;
            if (value !== englishValue) return false;
            const normalized = String(value).trim().toUpperCase();
            return normalized.length > 2 && !universalValues.has(normalized);
        });

        if (missing.length === 0 && extra.length === 0) {
            if (untranslated.length > 0) {
                console.log(`⚠️ ${lang} is synchronized but has ${untranslated.length} values identical to English.`);
                console.log(`   Sample: ${untranslated.slice(0, 5).join(', ')}`);
            } else {
                console.log(`✅ ${lang} is synchronized with no detected English fallbacks.`);
            }
        }
    } catch (e) {
        console.error(`❌ Error parsing ${file}:`, e.message);
        hasErrors = true;
    }
});

if (hasErrors) {
    console.error('\n❌ Locale audit failed. Run `npm run sync-locales` to fix synchronization issues.');
    process.exit(1);
} else {
    console.log('\n🎉 All locale files are synchronized!');
    process.exit(0);
}
