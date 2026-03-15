const fs = require('fs');

const FILE_PATH = './src/frontend/src/lib/i18n.ts';

const NEW_KEYS = {
    theme_choose: "Choose Theme",
    theme_select_aesthetic: "Select an agricultural aesthetic",
    theme_close: "Close"
};

let content = fs.readFileSync(FILE_PATH, 'utf-8');

const languages = ['en', 'sw', 'fr', 'pt', 'es', 'oro', 'lug', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el'];

languages.forEach(lang => {
    const regex = new RegExp(`{\\s*code:\\s*'${lang}'[^}]*flag:\\s*'[^']*'\\s*`, 'g');
    const match = regex.exec(content);
    
    if (match) {
        let insertStr = "";
        for (const [k, v] of Object.entries(NEW_KEYS)) {
            insertStr += `\n        ${k}: "${v}",`;
        }
        
        content = content.slice(0, match.index + match[0].length) + insertStr + content.slice(match.index + match[0].length);
    }
});

fs.writeFileSync(FILE_PATH, content, 'utf-8');
console.log("Minor strings injected.");
