const fs = require('fs');

const FILE_PATH = './src/frontend/src/lib/i18n.ts';

const NEW_KEYS = {
    visits_schedule_new: "Schedule New Visit",
    reports_generate_new: "Generate New Report",
    reports_description_prefix: "Comprehensive analysis of ",
    reports_description_suffix: " trends and performance metrics for the current period.",
    knowledge_thinking: "Thinking...",
    ai_ask_button: "Ask AI"
};

let content = fs.readFileSync(FILE_PATH, 'utf-8');

// Find all language blocks and inject the keys
const languageRegex = /([a-z_0-9]+):\s*"(.*?)",?/g;

// A safe way is to find the end of each language block
const languages = ['en', 'sw', 'fr', 'pt', 'es', 'oro', 'lug', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el'];

languages.forEach(lang => {
    // Find the opening brace of this language's dictionary
    const regex = new RegExp(`{\\s*code:\\s*'${lang}'[^}]*flag:\\s*'[^']*'\\s*`, 'g');
    const match = regex.exec(content);
    
    if (match) {
        let insertStr = "";
        for (const [k, v] of Object.entries(NEW_KEYS)) {
            insertStr += `\n        ${k}: "${v}",`;
        }
        
        let newContent = content.slice(0, match.index + match[0].length) + insertStr + content.slice(match.index + match[0].length);
        content = newContent;
    }
});

fs.writeFileSync(FILE_PATH, content, 'utf-8');
console.log("App strings injected.");
