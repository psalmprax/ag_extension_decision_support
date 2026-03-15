const fs = require('fs');

const FILE_PATH = './src/frontend/src/lib/i18n.ts';

const NEW_KEYS = {
    usage_init_title: "Initialize Mission Control",
    usage_init_desc: "Unlock powerful AI and SMS capabilities by selecting a deployment plan.",
    usage_realtime_telemetry: "Real-time Telemetry",
    usage_critical_threshold: "Critical Threshold"
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
console.log("Usage strings injected.");
