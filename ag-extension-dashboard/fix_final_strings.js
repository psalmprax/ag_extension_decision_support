const fs = require('fs');

const FILE_PATH = './src/frontend/src/lib/i18n.ts';

const NEW_KEYS = {
    // FarmerDetailPanel
    action_chat: "Chat",
    action_sms: "SMS",
    action_call: "Call",
    action_video: "Video",
    farmer_vital_score: "Vital Score",
    visit_no_history: "No visit history found",
    visit_routine_inspection: "Routine farm inspection and soil health assessment.",
    visit_next_scheduled: "Next Scheduled",
    action_start_synthesis: "Start Synthesis",
    
    // FarmerMap
    map_type: "Map Type",
    map_legend: "Crop Legend",
    map_search_placeholder: "Search farmers...",
    map_locate_me: "Locate Me",
    map_reset_view: "Reset View",
    map_toggle_stats: "Toggle Stats",
    map_overview: "Overview",
    map_farms: "Farms",
    map_hectares: "Hectares",
    map_top_crops: "Top Crops",
    farmer_active_since: "Active Since",
    farmer_est_yield: "Est. Yield",
    farmer_farm_size: "Farm Size"
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
console.log("Final strings injected.");
