
import fs from 'fs';
import path from 'path';

const filePath = path.resolve('/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend/src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

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
        nav_billing: "Kaffaltii fi Abbummaa",
        nav_dashboard_label: "Daashboard",
        nav_my_farm: "Qonna Koo",
        nav_ai_advisor: "Gorsaa AI",
        nav_farmer_chat: "Hasawaa Qotee Bulaa",
        nav_knowledge_base: "Beeksisa Beekumsaa",
        nav_portfolio: "Portfolio",
        nav_register_farmer: "Qotee Bulaa Galmeessi",
        nav_visit_ai: "Gorsaa Daawwannaa AI",
        nav_reports_label: "Gabaasawwan",
        nav_analytics_label: "Xiinxala",
    },
    zu: {
        app_title: "Ag-Extension",
        app_subtitle: "Ukuphathwa kwezinqumo",
        dashboard_title: "Ideshibhodi yobunhloli",
        dashboard_overview: "Ukubuka konke kwedeshibhodi",
        dashboard_welcome: "Siyakwamukela futhi, {name}!",
        urgent_signals: "Izimpawu eziphuthumayo",
        impact_metrics: "Izilinganiso zomthelela",
        farmers_reached: "Abalimi abafinyelelwe",
        queries_resolved: "Imibuzo exazululiwe",
        avg_response_time: "Isikhathi sokuphendula",
        regional_coverage: "Ukusabalala kwesifunda",
        prioritized_visits: "Ukuvakashela okubalulekile",
        ai_advisory_hub: "Isizinda seluleko se-AI",
        consult_kb: "Bheka ulwazi",
        signal_alerts: "Izaziso",
        new_impact_report: "Umbiko omusha womthelela",
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
        stat_visits_this_month: "Ukuvakashela kuleli nyanga",
        stat_avg_satisfaction: "Isilinganiso sokwaneliseka",
        billing_title: "Ukukhokha nokubhalisa",
        billing_subtitle: "Phatha ukubhalisa kwakho namapulani",
        billing_status_active: "Kusebenza",
        billing_status_canceled: "Kukhanseliwe",
        sms_quota_remaining: "{count} kusele amakhredithi",
        login_title: "Siyakwamukela futhi",
        login_subtitle: "Ngena ngemvume ukuze ufinyelele kudeshibhodi yakho",
        login_email: "Ikheli le-imeyili",
        login_password: "Iphasiwedi",
    },
    ar: {
        billing_title: "الفواتير والاشتراك",
        billing_subtitle: "إدارة اشتراكك وخططك وطرق الدفع",
        billing_current_plan: "الخطة الحالية",
        billing_upgrade_plan: "ترقية الخطة",
        billing_manage_subscription: "إدارة الاشتراك",
        billing_plan_free: "مجاني",
        billing_plan_pro: "برو",
        billing_plan_enterprise: "المؤسسات",
        billing_price_monthly: "{price}/شهر",
        billing_features: "المميزات",
        billing_status_active: "نشط",
        billing_status_canceled: "ملغي",
        billing_renewal_date: "يتجدد في {date}",
        sms_quota_remaining: "{count} رصيد متبقي",
        nav_billing: "الفواتير والاشتراك",
        stat_total_farmers: "إجمالي المزارعين",
        stat_active_conversations: "المحادثات النشطة",
        stat_visits_this_month: "زيارات هذا الشهر",
        stat_avg_satisfaction: "متوسط الرضا",
        sms_title: "رسائل SMS",
        sms_subtitle: "التفاعل مع المزارعين عبر الرسائل الآلية والمباشرة",
    },
    sw: {
        billing_title: "Malipo na Usajili",
        billing_subtitle: "Dhibiti usajili wako, mipango, na mbinu za malipo",
        billing_status_active: "Inatumika",
        billing_status_canceled: "Imeghairiwa",
        sms_quota_remaining: "{count} mikopo imesalia",
        nav_billing: "Malipo na Usajili",
        stat_total_farmers: "Jumla ya Wakulima",
        stat_active_conversations: "Mazungumzo Yanayotumika",
        stat_visits_this_month: "Ziara za Mwezi Huu",
    }
};

Object.entries(updates).forEach(([lang, keys]) => {
    const blockRegex = new RegExp(`${lang}: \\{[\\s\\S]*?\\},`, 'g');
    const match = content.match(blockRegex);
    if (match) {
        let block = match[0];
        Object.entries(keys).forEach(([key, val]) => {
            const keyRegex = new RegExp(`${key}: ".*?",`, 'g');
            if (block.match(keyRegex)) {
                block = block.replace(keyRegex, `${key}: "${val}",`);
            } else {
                block = block.replace(`${lang}: {`, `${lang}: {\n        ${key}: "${val}",`);
            }
        });
        content = content.replace(blockRegex, block);
    }
});

fs.writeFileSync(filePath, content);
console.log('✅ i18n.ts updated with comprehensive translations!');
