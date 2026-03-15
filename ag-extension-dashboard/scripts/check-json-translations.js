const fs = require('fs');
const path = require('path');

const localesDir = path.resolve(__dirname, '../src/frontend/public/locales');

function validateJsonTranslations() {
    console.log('🔍 Starting JSON translation validation...');
    
    if (!fs.existsSync(localesDir)) {
        console.error(`❌ Locales directory not found: ${localesDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
    const englishPath = path.join(localesDir, 'en.json');
    
    if (!fs.existsSync(englishPath)) {
        console.error('❌ en.json not found');
        process.exit(1);
    }

    const en = JSON.parse(fs.readFileSync(englishPath, 'utf8'));
    const englishKeys = Object.keys(en);
    console.log(`✅ Base language: English [en] with ${englishKeys.length} keys.`);

    let totalMissing = 0;
    let totalFiles = 0;

    files.forEach(file => {
        if (file === 'en.json') return;
        totalFiles++;
        const lang = file.replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
        const keys = Object.keys(data);
        
        const missingKeys = englishKeys.filter(k => !data[k]);
        if (missingKeys.length > 0) {
            console.error(`❌ [${lang}] is missing ${missingKeys.length} keys.`);
            console.error(`   Sample: ${missingKeys.slice(0, 5).join(', ')}`);
            totalMissing += missingKeys.length;
        } else {
            console.log(`✅ [${lang}] is 100% in sync (${keys.length} keys).`);
        }
    });

    console.log('-----------------------------------');
    if (totalMissing === 0) {
        console.log(`✨ All ${totalFiles + 1} locales (including English) are 100% synchronized! ✨`);
    } else {
        console.error(`❌ Total missing keys across all languages: ${totalMissing}`);
        process.exit(1);
    }
}

validateJsonTranslations();
