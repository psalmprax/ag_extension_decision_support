
import fs from 'fs';
import path from 'path';

// Load the i18n file
const filePath = path.resolve('/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The missing translations map (example for Oromo)
const updates: Record<string, Record<string, string>> = {
    oro: {
        billing_status_canceled: "Haqameera",
        billing_renewal_date: "Kan haaromu {date}",
        billing_cancel_link: "Subscription Haqadhu",
        billing_portal_button: "Kuusaa maamiltootaa bani",
        billing_select_plan: "Sagantaa Filadhu",
        billing_upgrade_plan: "Pilaanii fooyyessi",
        billing_plan_free: "Bilisa",
        billing_plan_pro: "Piroo",
        billing_plan_enterprise: "Intarppiraayizii",
        billing_price_monthly: "{price}/ji'aan",
        billing_usage_metrics: "Safartuu Itti Fayyadamaa",
        billing_ai_messages: "Ergaawwan AI Fayyadaman",
        billing_next_billing_date: "Guyyaa Kaffaltii Itti Aanu",
        billing_manage_subscription: "Subscription Bulchi",
        stat_avg_satisfaction: "Giddu-galeessa quubsummaa",
        stat_regional_distribution: "Raabsa naannoo",
        stat_malawi_overview: "Malawi Gahee Waliigalaa",
        stat_weather_widget: "Haala Qilleensaa",
        stat_ai_insights: "Hubannoo AI",
        stat_recent_activity: "Hojii dhihoo",
        stat_pending_visits: "Daawwannaa eeggannoo",
        stat_urgent_signals: "Mallattoo ariifachiisoo",
        analytics_disease_alerts: "Akeekkachiisa dhukkubaa",
        map_search_placeholder: "Qotee bulttoota bari...",
        map_locate_me: "Iddoo koo bari",
        map_reset_view: "Ilaalcha deebisi",
        map_toggle_stats: "Istaatistiiksii jijjiiri",
        map_overview: "Gahee waliigalaa",
        map_farms: "Qonnaawwan",
        map_hectares: "Heektaara",
        map_top_crops: "Midhaanii ol-aanoo",
        farmer_active_since: "Hojii kan jalqabe",
        farmer_est_yield: "Omisha tilmaamamaa",
        farmer_farm_size: "Bal'ina qonnaa",
        sms_quota_remaining: "{count} kiraadiitii hafeera",
        reports_description_prefix: "Analysis bal'aa waa'ee ",
        reports_description_suffix: " adeemsa fi qabxiiwwan raawwii yeroo ammaa.",
        knowledge_thinking: "Yaadaa jira...",
        theme_select_aesthetic: "Bifa qonnaa filadhu",
        visit_routine_inspection: "Daawwannaa idilee qonnaa fi madaallii fayyaa biyyooyyee.",
    },
    zu: {
        nav_dashboard: "Ideshibhodi",
        nav_farmers: "Abalimi",
        nav_visits: "Ukuvakashela",
        nav_knowledge: "Ulwazi",
        nav_sms: "SMS",
        nav_analytics: "Ukuhlaziywa",
        nav_reports: "Imibiko",
        nav_billing: "Izinkokhelo nokubhalisa",
        nav_settings: "Izilungiselelo",
        nav_logout: "Phuma",
        stat_total_farmers: "Abalimi bonke",
        stat_active_conversations: "Izinkulumo ezisebenzayo",
        stat_visits_this_month: "Ukuvakashela kwaleli nyanga",
        stat_avg_satisfaction: "Isilinganiso sokwaneliseka",
        billing_title: "Ukukhokha nokubhalisa",
        billing_subtitle: "Phatha ukubhalisa kwakho, amapulani, nezindlela zokukhokha",
        billing_status_active: "Kusebenza",
        billing_status_canceled: "Kukhanseliwe",
        sms_quota_remaining: "{count} kusele amakhredithi",
    },
    ar: {
        billing_title: "الفواتير والاشتراك",
        billing_subtitle: "إدارة اشتراكك وخططك وطرق الدفع",
        billing_status_active: "نشط",
        billing_status_canceled: "ملغي",
        sms_quota_remaining: "{count} رصيد متبقي",
        nav_billing: "الفواتير والاشتراك",
    }
};

// Simple injection logic: regex find the language block and append/update keys
Object.entries(updates).forEach(([lang, keys]) => {
    const blockRegex = new RegExp(`${lang}: \\{[\\s\\S]*?\\},`, 'g');
    const match = content.match(blockRegex);
    if (match) {
        let block = match[0];
        Object.entries(keys).forEach(([key, val]) => {
            // Check if key already exists
            const keyRegex = new RegExp(`${key}: ".*?",`, 'g');
            if (block.match(keyRegex)) {
                block = block.replace(keyRegex, `${key}: "${val}",`);
            } else {
                // Prepend after the opening brace
                block = block.replace(`${lang}: {`, `${lang}: {\n        ${key}: "${val}",`);
            }
        });
        content = content.replace(blockRegex, block);
    }
});

fs.writeFileSync(filePath, content);
console.log('✅ i18n.ts updated successfully!');
