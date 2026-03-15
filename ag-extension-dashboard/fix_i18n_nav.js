const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/frontend/src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

const keysToAdd = {
    nav_billing: "Billing & Subscription"
};

const regex = /([a-z]{2,3}):\s*\{([\s\S]*?)\},/g;
let match;
let newContent = content;

while ((match = regex.exec(content)) !== null) {
    const lang = match[1];
    let block = match[2];
    
    let added = false;
    for (const [key, value] of Object.entries(keysToAdd)) {
        if (!block.includes(`${key}:`)) {
            // Append it near nav_settings or at the end
            block += `\n        ${key}: "${value}",`;
            added = true;
        }
    }
    
    if (added) {
        newContent = newContent.replace(match[0], `${lang}: {${block}\n    },`);
    }
}

fs.writeFileSync(filePath, newContent);
console.log('Appended nav_billing to all languages');
