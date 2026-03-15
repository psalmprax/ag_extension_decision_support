const fs = require('fs');
const FILE_PATH = './src/frontend/src/lib/i18n.ts';

let content = fs.readFileSync(FILE_PATH, 'utf-8');

// 1. Remove incorrectly injected keys from the languages array
const languages = ['en', 'sw', 'fr', 'pt', 'es', 'oro', 'lug', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el'];

// Removing the injected block from the languages array definition
// The bad injection starts after flag: '...' and ends before },
languages.forEach(lang => {
    // This regex looks for the exact badly injected pattern
    const regex = new RegExp(`({\\s*code:\\s*'${lang}'[^}]*flag:\\s*'[^']*'\\s*)([\\s\\S]*?)(},)`, 'g');
    content = content.replace(regex, (match, p1, p2, p3) => {
        // Just keep the code, name, flag part and the closing brace
        return p1.trim() + " " + p3;
    });
});

// 2. Now correctly inject all the new keys into the 'translations' object
const NEW_KEYS = {
    // App Strings
    visits_schedule_new: "Schedule New Visit",
    reports_generate_new: "Generate New Report",
    reports_description_prefix: "Comprehensive analysis of ",
    reports_description_suffix: " trends and performance metrics for the current period.",
    knowledge_thinking: "Thinking...",
    ai_ask_button: "Ask AI",
    
    // Minor Strings
    theme_choose: "Choose Theme",
    theme_select_aesthetic: "Select an agricultural aesthetic",
    theme_close: "Close",
    
    // Usage Strings
    usage_init_title: "Initialize Mission Control",
    usage_init_desc: "Unlock powerful AI and SMS capabilities by selecting a deployment plan.",
    usage_realtime_telemetry: "Real-time Telemetry",
    usage_critical_threshold: "Critical Threshold",
    
    // Final Strings
    action_chat: "Chat",
    action_sms: "SMS",
    action_call: "Call",
    action_video: "Video",
    farmer_vital_score: "Vital Score",
    visit_no_history: "No visit history found",
    visit_routine_inspection: "Routine farm inspection and soil health assessment.",
    visit_next_scheduled: "Next Scheduled",
    action_start_synthesis: "Start Synthesis",
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

// Find the translations object and inject the keys for each language
languages.forEach(lang => {
    const translationBlockRegex = new RegExp(`(${lang}:\\s*{\\s*translation:\\s*{)([\\s\\S]*?)(}\\s*})`, 'g');
    content = content.replace(translationBlockRegex, (match, p1, p2, p3) => {
        let insertStr = "";
        for (const [k, v] of Object.entries(NEW_KEYS)) {
            insertStr += `\n            ${k}: "${v}",`;
        }
        return p1 + insertStr + p2 + p3;
    });
});

fs.writeFileSync(FILE_PATH, content, 'utf-8');
console.log("Syntax fixed and keys correctly injected.");
