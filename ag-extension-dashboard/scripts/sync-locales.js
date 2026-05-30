const fs = require('node:fs');
const path = require('node:path');

const localesDir = path.join(__dirname, '../src/frontend/public/locales');
const enPath = path.join(localesDir, 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enKeys = Object.keys(enData);

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

console.log(`Synchronizing ${files.length} language files against en.json (${enKeys.length} keys)...`);

files.forEach(file => {
    const filePath = path.join(localesDir, file);
    
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const keys = Object.keys(data);
        
        const missing = enKeys.filter(k => !keys.includes(k));
        const extra = keys.filter(k => !enKeys.includes(k));
        
        let updatedData = { ...data };
        
        // 1. Prune extra keys
        if (extra.length > 0) {
            console.log(`  Pruning ${extra.length} extra keys from ${file}...`);
            extra.forEach(k => delete updatedData[k]);
        }
        
        // 2. Add missing keys (with fallback to English)
        if (missing.length > 0) {
            missing.forEach(k => {
                updatedData[k] = enData[k];
            });
            console.log(`  Added ${missing.length} missing keys to ${file}.`);
        }
        
        // 3. Sort keys alphabetically (matching en.json order)
        const sortedData = {};
        enKeys.forEach(k => {
            sortedData[k] = updatedData[k];
        });
        
        fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 4));
        console.log(`✅ ${file} synchronized successfully.`);
    } catch (e) {
        console.error(`❌ Error syncing ${file}:`, e.message);
    }
});

console.log('\n🎉 Sync complete! All locale JSON files are perfectly synchronized.');
