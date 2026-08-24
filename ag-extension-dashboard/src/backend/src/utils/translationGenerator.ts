/**
 * AI-Powered Translation Generator
 * 
 * This utility uses AI to generate translations for the i18n system.
 * Run with: npx tsx src/utils/translationGenerator.ts
 */

import { AIProviderFactory } from '../services/aiProvider/aiProvider';

// Source English translations to translate
const englishTranslations = {
    viz_yield_trends: "Yield Trends",
    viz_growth_positive: "+12% Growth",
    chat_new_conv: "New Conversation",
    chat_enter_msg: "Enter message...",
    kb_ask_ai: "Ask AI...",
    visit_date_march: "March 24th, 2026",
    visits_schedule_new: "Schedule New Visit",
    reports_generate_new: "Generate New Report",
    reports_description_prefix: "Comprehensive analysis of ",
    reports_description_suffix: " trends and performance metrics for the current period.",
    knowledge_thinking: "Thinking...",
    ai_ask_button: "Ask AI",
    theme_choose: "Choose Theme",
    theme_select_aesthetic: "Select an agricultural aesthetic",
    theme_close: "Close",
    usage_init_title: "Usage Intelligence",
    usage_init_desc: "Fetching usage telemetry...",
    usage_realtime_telemetry: "Real-time Telemetry",
    usage_critical_threshold: "Critical Threshold",
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
    farmer_farm_size: "Farm Size",
    app_title: "GPExts",
    app_subtitle: "Decision Support",
    dashboard_title: "Intelligence Dashboard",
    dashboard_overview: "Dashboard Overview",
    dashboard_welcome: "Welcome back, {name}! Here's your current performance.",
    urgent_signals: "Urgent Priority Signals Active",
    impact_metrics: "Impact Metrics",
    farmers_reached: "Farmers Reached",
    queries_resolved: "Queries Resolved",
    avg_response_time: "Avg Response Time",
    regional_coverage: "Regional Coverage",
    prioritized_visits: "Prioritized Visit Portfolio",
    ai_advisory_hub: "AI Advisory Hub",
    consult_kb: "Consult Knowledge Base",
    signal_alerts: "Signal Alerts",
    new_impact_report: "New Impact Report",
    nav_dashboard: "Dashboard",
    nav_farmers: "Farmers",
    nav_visits: "Visits",
    nav_knowledge: "Knowledge",
    nav_sms: "SMS",
    nav_analytics: "Analytics",
    nav_reports: "Reports",
    nav_settings: "Settings",
    nav_logout: "Logout",
    common_search: "Search",
    common_filter: "Filter",
    common_export: "Export",
    common_save: "Save",
    common_cancel: "Cancel",
    common_delete: "Delete",
    common_edit: "Edit",
    common_add: "Add",
    common_loading: "Loading...",
    common_error: "Error",
    common_success: "Success",
    common_no_data: "No data available",
    common_select_language: "Select Language",
    common_ai_powered: "AI Powered",
    common_new_conversation: "New Conversation",
    common_search_farmers: "Search farmers by name or region...",
    nav_dashboard_label: "Dashboard",
    nav_my_farm: "My Farm",
    nav_ai_advisor: "AI Advisor",
    nav_farmer_chat: "Farmer Chat",
    nav_knowledge_base: "Knowledge Base",
    nav_portfolio: "Portfolio",
    nav_register_farmer: "Register Farmer",
    nav_visit_ai: "Visit AI Advisor",
    nav_reports_label: "Reports",
    nav_analytics_label: "Analytics",
    sms_recent_recipients: "Recent Recipients",
    sms_tab_compose: "Compose",
    sms_tab_history: "History",
    sms_single_tab: "Single",
    sms_bulk_tab: "Bulk",
    sms_phone_label: "Phone Number",
    sms_bulk_recipients: "Bulk Recipients",
    sms_message_label: "Message",
    sms_char_count: "{count} characters",
    sms_sending: "Sending...",
    sms_send_button: "Send SMS",
    sms_bulk_button: "Send Bulk SMS",
    sms_quota_title: "SMS Quota",
    sms_stats_title: "Activity Stats",
    sms_stats_sent: "Sent",
    sms_stats_failed: "Failed",
    sms_template_title: "Templates",
    sms_template_weather: "Weather Alert",
    sms_template_weather_content: "Urgent: Expect heavy rain in your region tomorrow. Protect your harvest.",
    sms_template_visit: "Schedule Visit",
    sms_template_visit_content: "Hello, I would like to schedule a field visit to your farm this week.",
    sms_template_price: "Market Price Update",
    sms_template_price_content: "Current market price for Maize is 240 MWK/kg at your local market.",
    video_consult_title: "Video Consultation",
    video_participants_count: "{count} participant(s)",
    video_camera_off_hint: "Camera will be enabled when you join",
    video_starting: "Starting...",
    video_start_call: "Start Call",
    video_joining: "Joining...",
    video_join_call: "Join Call",
    video_waiting_others: "Waiting for others to join...",
    video_in_call_count: "{count} in call",
    video_mute: "Mute",
    video_unmute: "Unmute",
    video_camera_on: "Turn on camera",
    video_camera_off: "Turn off camera",
    video_end_call: "End call",
    video_leave: "Leave",
    video_participant_label: "Participant",
    video_host_label: "Host",
    farmer_register_title: "Farmer Registration",
    farmer_register_subtitle: "Register a new farmer into the extension database",
    farmer_register_name: "Full Name",
    farmer_register_name_placeholder: "Enter farmer's full name",
    farmer_register_phone: "Phone Number",
    farmer_register_phone_placeholder: "+254 --- --- ---",
    farmer_register_location: "Primary Location/Village",
    farmer_register_location_placeholder: "Village, District",
    farmer_register_farm_size: "Total Farm Size",
    gps_coordinates: "GPS Coordinates",
    detect_location: "Detect Location",
    latitude: "Latitude",
    longitude: "Longitude",
    farmer_register_button: "Register Farmer",
    farmer_register_success: "Farmer registered successfully!",
    farmer_register_failed: "Failed to register farmer.",
    visit_synthesis_title: "Visit Synthesis",
    visit_synthesis_subtitle: "AI-powered visit report generator",
    visit_synthesis_placeholder: "Type your observation notes here...",
    visit_synthesis_generate: "Generate Synthesis",
    visit_synthesis_success: "Synthesis generated successfully!",
    visit_synthesis_error: "Failed to generate synthesis.",
    exec_summary: "Executive Summary",
    crop_health: "Crop Health",
    follow_up: "Follow-Up",
    pest_status: "Pest Status",
    key_observations: "Key Observations",
    rec_actions: "Recommended Actions",
    save_records: "Save to Records",
    common_yes: "Yes",
    common_no: "No",
    thinking: "Thinking...",
    error_loading: "Error loading dashboard",
    nav_billing: "Billing & Subscription",
    common_optional: "Optional",
    stat_total_farmers: "Total Farmers",
    stat_active_conversations: "Active Conversations",
    stat_visits_this_month: "Visits This Month",
    stat_avg_satisfaction: "Avg Satisfaction",
    stat_regional_distribution: "Regional Distribution",
    stat_malawi_overview: "Malawi Overview",
    stat_weather_widget: "Weather",
    stat_ai_insights: "AI Insights",
    stat_recent_activity: "Recent Activity",
    stat_pending_visits: "Pending Visits",
    stat_urgent_signals: "Urgent Signals",
    analytics_disease_alerts: "Disease Alerts",
    table_farmer_details: "Farmer Details",
    table_region_village: "Region & Village",
    table_crops: "Crops",
    table_farm_size: "Farm Size",
    table_status: "Status",
    table_active: "Active",
    analytics_support_efficiency: "Support Efficiency",
    analytics_resolution_rate: "Resolution Rate",
    analytics_avg_response_time: "Avg. Response Time",
    analytics_satisfaction_score: "Satisfaction Score",
    analytics_follow_up_rate: "Follow-up Rate",
    analytics_first_contact_res: "First Contact Res.",
    analytics_activity_timeline: "Activity Timeline",
    chat_select_conversation: "Select a Conversation",
    chat_connect_farmers: "Connect with your assigned farmers in real-time to provide agricultural guidance.",
    chat_start_new: "Start New Conversation",
    chat_select_farmer: "Select a farmer to chat with",
    chat_loading_farmers: "Loading farmers...",
    chat_no_farmers: "No farmers found",
    chat_ai_advisor: "AI Agricultural Advisor",
    chat_ai_ready: "Ready",
    chat_ask_anything: "Ask me anything about:",
    chat_farmer_chats: "Farmer Chats",
    chat_direct_chat: "Direct Chat",
    chat_no_conversations: "No conversations yet.",
    chat_start_new_chat: "Start a new chat with a farmer.",
    chat_rename_conversation: "Rename conversation",
    chat_delete_conversation: "Delete conversation",
    chat_confirm_delete: "Are you sure you want to delete this conversation?",
    empty_no_farmers: "No farmers found",
    empty_no_farmers_desc: "Add farmers to your portfolio to get started.",
    empty_no_visits: "No visits scheduled",
    empty_no_visits_desc: "Schedule a visit to a farmer to get started.",
    empty_no_analytics: "No analytics data",
    empty_no_analytics_desc: "Analytics data will appear once you have activity.",
    empty_no_conversations: "No conversations yet",
    empty_no_conversations_desc: "Start a conversation to get advice.",
    unknown_location: "Unknown location",
    chat_market_prices: "Market prices",
    chat_crop_diseases: "Crop diseases",
    chat_farming_practices: "Farming practices",
    chat_pest_management: "Pest management",
    chat_weather: "Weather",
    chat_recent: "Recent",
    farmer_greeting: "Jambo, {name}!",
    farmer_overview: "Here is your farm advisory overview.",
    farmer_my_crops: "My Crops",
    farmer_next_visit: "Next Visit",
    farmer_ai_advisory: "AI Advisory",
    farmer_alerts: "Alerts",
    farmer_market_prices: "Market Prices",
    farmer_ask_ai: "Ask AI Advisor",
    farmer_ai_description: "Get instant advice on pests, weather, and crop management.",
    farmer_start_chat: "Start Chat",
    weather_celsius: "Celsius",
    ai_expert_recommendation: "Expert Recommendation",
    ai_contextual_verification: "Contextual Verification",
    weather_title: "Weather",
    weather_malawi: "Malawi Weather",
    loading_generic: "Loading...",
    common_close: "Close",
    common_send: "Send",
    common_type_message: "Type a message...",
    login_title: "Welcome Back",
    login_subtitle: "Sign in to access your dashboard",
    login_want_explore: "Want to explore first?",
    login_try_demo: "Try the Demo",
    login_or: "or",
    login_email: "Email Address",
    login_password: "Password",
    login_signing_in: "Signing in...",
    login_no_account: "Don't have an account?",
    login_register_here: "Register here",
    register_title: "Create Account",
    register_subtitle: "Join the agricultural extension network",
    register_first_name: "First Name",
    register_last_name: "Last Name",
    register_role: "Select Role",
    register_role_extension: "Extension Officer",
    register_role_farmer: "Farmer",
    register_role_admin: "Administrator",
    register_region_optional: "Region (Optional)",
    register_confirm_password: "Confirm Password",
    register_creating: "Creating account...",
    register_have_account: "Already have an account?",
    register_sign_in: "Sign in",
    visit_create_title: "Schedule New Visit",
    visit_create_subtitle: "Book a visit with a farmer",
    visit_select_farmer_placeholder: "Choose a farmer...",
    visit_type_label: "Visit Type",
    visit_type_routine: "Routine",
    visit_type_followup: "Follow-up",
    visit_type_new: "New Farmer",
    visit_type_query: "Query",
    visit_type_emergency: "Emergency",
    visit_date_time: "Date & Time",
    visit_notes_placeholder: "Add any notes about this visit...",
    chat_input_placeholder: "Ask the AI Advisor about farming...",
    farmer_search_placeholder: "Search farmers...",
    farmer_chat_placeholder: "Type a message to the farmer...",
    viz_crop_planning: "Crop Planning",
    viz_pest_management: "Pest Management",
    viz_financial_aid: "Financial Aid",
    viz_export_readiness: "Export Readiness",
    viz_detail_view: "Detail View",
    billing_quota_usage: "Quota Usage",
    billing_limit_warning: "You are using over 90% of your SMS quota for this subscription. Consider upgrading your plan to continue messaging.",
    billing_title: "Billing & Subscription",
    billing_subtitle: "Manage your subscription, plans, and payment methods",
    billing_current_plan: "Current Plan",
    billing_upgrade_plan: "Upgrade Plan",
    billing_manage_subscription: "Manage Subscription",
    billing_plan_free: "Free",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Enterprise",
    billing_price_monthly: "{price}/month",
    billing_features: "Features",
    billing_status_active: "Active",
    billing_status_canceled: "Canceled",
    billing_renewal_date: "Renews on {date}",
    billing_cancel_link: "Cancel Subscription",
    billing_portal_button: "Open Customer Portal",
    billing_select_plan: "Select Plan",
    billing_usage_metrics: "Usage Metrics",
    billing_ai_messages: "AI Messages Used",
    billing_next_billing_date: "Next Billing Date",
    billing_payment_intelligence: "Payment Intelligence",
    billing_stored_protocols: "Stored Financial Protocols",
    billing_add_method: "Add Method",
    billing_expires: "Expires {date}",
    billing_no_secure_methods: "No secure payment methods found",
    billing_paypal_gateway: "PayPal Gateway",
    billing_global_p2p: "Global P2P & Business Transfers",
    billing_link_account: "Link Account",
    billing_legacy_transactions: "Legacy Transactions",
    billing_transaction_archive: "Transaction Archive",
    billing_timeframe: "Timeframe",
    billing_evaluation: "Evaluation",
    billing_execution: "Execution",
    billing_download: "Download",
    billing_unavailable: "Unavailable",
    billing_no_records: "No records found",
    sms_title: "SMS Messaging",
    sms_subtitle: "Engage with farmers via automated and direct SMS",
    sms_quota_remaining: "{count} credits remaining",
};

// Target languages to translate to
const targetLanguages = [
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'oro', name: 'Oromo', nativeName: 'Oromo' },
    { code: 'lug', name: 'Luganda', nativeName: 'Luganda' },
    { code: 'zu', name: 'Zulu', nativeName: 'Zulu' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
    { code: 'da', name: 'Danish', nativeName: 'Dansk' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski' },
    { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
    { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
    { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
];

async function generateTranslations() {
    console.log('🚀 Starting AI Translation Generator...\n');

    const provider = await AIProviderFactory.getProvider('groq');
    const allTranslations: Record<string, Record<string, string>> = {};

    // Add existing English translations
    allTranslations['en'] = englishTranslations;

    // Also add existing translations we know work
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _existingTranslations = {
        sw: {}, fr: {}, de: {}, es: {}  // These have manual translations
    };

    for (const lang of targetLanguages) {
        console.log(`🌐 Translating to ${lang.name} (${lang.code})...`);

        const translations: Record<string, string> = {};

        // Build prompt with all keys to translate
        const translationList = Object.entries(englishTranslations)
            .map(([key, value]) => `"${key}": "${value.replace(/"/g, '\\"')}"`)
            .join(',\n        ');

        const prompt = `You are a professional translator. Translate the following English text to ${lang.name} (${lang.nativeName}). 
        
Return ONLY a JSON object with the translations. Keep {name} and {count} placeholders as-is.
Do NOT include any explanation or additional text.

JSON format:
{
        ${translationList}
}`;

        try {
            const response = await provider.generateText([
                { role: 'user', content: prompt }
            ], {});

            // Parse the AI response
            const result = response as { text?: string };
            const responseText = result.text || '';
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                Object.assign(translations, parsed);
                console.log(`   ✅ Generated ${Object.keys(translations).length} translations`);
            } else {
                console.log(`   ❌ Could not parse AI response`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error}`);
        }

        allTranslations[lang.code] = translations;
    }

    // Output the translations
    console.log('\n📝 Generated Translations:\n');
    console.log(JSON.stringify(allTranslations, null, 2));
}

// Run if executed directly
if (require.main === module) {
    generateTranslations()
        .then(() => console.log('\n✨ Done!'))
        .catch(console.error);
}

export { generateTranslations, englishTranslations, targetLanguages };
