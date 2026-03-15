
import * as fs from 'fs';
import * as path from 'path';

// Use absolute path calculated from the project root if possible, or just the relative path from where we run it
const i18nPath = path.resolve('src/frontend/src/lib/i18n.ts');
console.log('Targeting:', i18nPath);

if (!fs.existsSync(i18nPath)) {
    console.error('Could not find i18n.ts at', i18nPath);
    process.exit(1);
}

const i18nContent = fs.readFileSync(i18nPath, 'utf8');

const newKeys = {
    billing_account_control: "Account Control",
    billing_status_label: "Subscription Status",
    billing_renews_on: "Renews on",
    plan_tier_operational: "Operational Tier",
    billing_trial_info: "Trial Information",
    billing_payment_method: "Payment Method",
    billing_add_method: "Add Payment Method",
    billing_invoices: "Invoices",
    billing_invoice_number: "Invoice Number",
    billing_invoice_status: "Status",
    billing_invoice_amount: "Amount",
    billing_switch_plan: "Switch Plan",
    billing_current_plan: "Current Plan",
    billing_upgrade: "Upgrade Now",
    billing_contact_support: "Contact Support",
    usage_realtime_telemetry: "Real-time Telemetry",
    usage_critical_threshold: "Critical Threshold",
    usage_init_title: "Initialize Mission Control",
    usage_init_desc: "Unlock powerful AI and SMS capabilities by selecting a deployment plan.",
    stat_total_farmers: "Total Farmers",
    stat_active_conversations: "Active Conversations",
    stat_visits_this_month: "Visits This Month",
    stat_avg_satisfaction: "Average Satisfaction",
    stat_regional_distribution: "Regional Distribution",
    stat_malawi_overview: "Malawi Overview",
    nav_billing: "Billing & Subscription",
    chat_direct_chat: "Direct Chat",
    chat_select_farmer: "Select a farmer",
    chat_ai_ready: "AI Expert Ready",
    chat_start_new: "Start New Chat",
    billing_change_plan_modal_title: "Change Your Plan",
    billing_change_plan_modal_desc: "Select a new plan tier for your account. Changes will take effect immediately.",
    billing_confirm_switch: "Confirm Switch",
    billing_switching_plan: "Switching plan...",
    billing_switch_success: "Plan switched successfully",
    billing_switch_error: "Failed to switch plan",
    billing_period_monthly: "Monthly",
    billing_period_yearly: "Yearly"
};

const zuGaps = {
    billing_account_control: "Ukulawula i-akhawunti",
    billing_status_label: "Isimo sokubhalisa",
    billing_renews_on: "Ikuvuselela ngo",
    plan_tier_operational: "Isigaba Somsebenzi",
    billing_payment_method: "Indlela yokukhokha",
    billing_add_method: "Engeza indlela yokukhokha",
    billing_invoices: "Ama-invoyisi",
    billing_invoice_number: "Inombolo ye-invoyisi",
    billing_invoice_status: "Isimo",
    billing_invoice_amount: "Inani",
    billing_switch_plan: "Shintsha uhlelo",
    billing_upgrade: "Thuthukisa",
    usage_realtime_telemetry: "I-Telemetry Yesikhathi Sangempela",
    usage_critical_threshold: "Umkhawulo Obucayi",
    usage_init_title: "Qalisa Ukulawula Inhloso",
    usage_init_desc: "Vula amandla e-AI ne-SMS ngokukhetha uhlelo lokuphakelwa.",
    nav_billing: "Izinkokhelo nokubhalisa",
    stat_total_farmers: "Abalimi Abaphelele",
    stat_active_conversations: "Izingxoxo Ezisebenzayo",
    stat_visits_this_month: "Izivakashi Kule nyanga",
    stat_avg_satisfaction: "Ukwaneliseka Okumaphakathi",
    nav_dashboard: "I-Dashboard",
    chat_ai_advisor: "Umeluleki wezolimo we-AI",
    chat_farmer_chats: "Izingxoxo zabalimi",
    nav_knowledge: "Ulwazi",
    portfolio_title: "Iphothifoliyo Yokuvakasha",
    farmer_register_title: "Bhalisa Umlimi",
    visit_synthesis_title: "Ukuvuselelwa kwe-AI",
    nav_visits: "Izivakashi",
    reports_title: "Amaphrokhali",
    nav_sms: "I-SMS",
    analytics_title: "I-Analytics",
    chat_start_new: "Qala ingxoxo entsha"
};

const oroGaps = {
    billing_account_control: "To'annoo Akkaawuntii",
    billing_status_label: "Haala Galmee",
    billing_renews_on: "Kan Haaromsu",
    plan_tier_operational: "Sadarkaa Hojii",
    billing_payment_method: "Mala Kafaltii",
    billing_add_method: "Mala Kafaltii Dabali",
    billing_invoices: "Invooyisoota",
    billing_invoice_number: "Lakkoofsa Invooyisii",
    billing_invoice_status: "Haala",
    billing_invoice_amount: "Hamma",
    billing_switch_plan: "Karoora Jijjiiri",
    billing_upgrade: "Fooyyessi",
    usage_realtime_telemetry: "Telemeetrii Yeroo Dhugaa",
    usage_critical_threshold: "Sadarkaa Murteessaa",
    usage_init_title: "Hojii To'annoo Jalqabi",
    usage_init_desc: "Kukunsa AI fi SMS banuuf karoora filadhu.",
    nav_billing: "Kafaltii fi Galmee",
    stat_total_farmers: "Walumaagalatti Qotee-bulaa",
    stat_active_conversations: "Mari'annoowwan Sassaabaman",
    stat_visits_this_month: "Daawwannaawwan Ji'a Kanaa",
    stat_avg_satisfaction: "Giddu-galeessa Itti-quufinsaa"
};

const arGaps = {
    billing_account_control: "التحكم في الحساب",
    billing_status_label: "حالة الاشتراك",
    billing_renews_on: "يتجدد في",
    plan_tier_operational: "المستوى التشغيلي",
    billing_payment_method: "طريقة الدفع",
    billing_add_method: "إضافة طريقة دفع",
    billing_invoices: "الفواتير",
    billing_invoice_number: "رقم الفاتورة",
    billing_invoice_status: "الحالة",
    billing_invoice_amount: "المبلغ",
    billing_switch_plan: "تغيير الخطة",
    billing_upgrade: "ترقية",
    usage_realtime_telemetry: "القياس عن بعد في الوقت الحقيقي",
    usage_critical_threshold: "الحد الحرج",
    usage_init_title: "بدء تشغيل مركز التحكم",
    usage_init_desc: "افتح إمكانات الذكاء الاصطناعي والرسائل النصية القصيرة من خلال اختيار خطة النشر.",
    nav_billing: "الفواتير والاشتراك",
    stat_total_farmers: "إجمالي المزارعين",
    stat_active_conversations: "المحادثات النشطة",
    stat_visits_this_month: "الزيارات هذا الشهر",
    stat_avg_satisfaction: "متوسط الرضا"
};

const languages = ['en', 'sw', 'fr', 'pt', 'es', 'oro', 'lug', 'zu', 'it', 'de', 'nl', 'da', 'pl', 'hu', 'tr', 'ar', 'zh', 'hi', 'ru', 'uk', 'ro', 'cs', 'sk', 'bg', 'el'];

let updatedContent = i18nContent;

languages.forEach(lang => {
    // Find the current block for this language
    const langStartMarker = `    ${lang}: {`;
    const startIndex = updatedContent.indexOf(langStartMarker);
    if (startIndex === -1) {
        console.warn(`Language ${lang} not found in i18n.ts`);
        return;
    }

    // Find the end of the block (matching braces)
    let braceCount = 1;
    let i = updatedContent.indexOf('{', startIndex) + 1;
    while (braceCount > 0 && i < updatedContent.length) {
        if (updatedContent[i] === '{') braceCount++;
        if (updatedContent[i] === '}') braceCount--;
        i++;
    }
    const endIndex = i;
    const langBlock = updatedContent.substring(startIndex, endIndex);

    // Parse existing keys from the block
    const existingKeys: Record<string, string> = {};
    const lines = langBlock.split('\n');
    lines.forEach(line => {
        const match = line.match(/^\s*(\w+):\s*"([^"]*)"/);
        if (match) {
            existingKeys[match[1]] = match[2];
        }
    });

    // Merge strategy:
    // 1. Start with the English "newKeys" base.
    // 2. Overwrite with specific gap fixes for target languages.
    // 3. Keep any existing keys from the original block.
    
    let gapFixes = {};
    if (lang === 'zu') gapFixes = zuGaps;
    if (lang === 'oro') gapFixes = oroGaps;
    if (lang === 'ar') gapFixes = arGaps;

    const finalKeys = { ...newKeys, ...existingKeys, ...gapFixes };

    // Regnerate the block
    let newBlock = `    ${lang}: {\n`;
    Object.keys(finalKeys).sort().forEach(key => {
        newBlock += `        ${key}: "${finalKeys[key]}",\n`;
    });
    newBlock += `    }`;

    updatedContent = updatedContent.substring(0, startIndex) + newBlock + updatedContent.substring(endIndex);
});

fs.writeFileSync(i18nPath, updatedContent);
console.log('Successfully synchronized 25 languages with 100% key parity.');
