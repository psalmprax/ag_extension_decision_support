/**
 * Translation Generator Utility
 * Uses the 'translate' package to auto-generate translations
 *
 * Run this in browser console or create a script to generate translations
 */

import translate from 'translate';

// Configure translate engine (uses Google Translate by default)
translate.engine = 'google';

// Language mapping from our codes to Google Translate codes
const languageMap: Record<string, string> = {
  pt: 'pt',
  fr: 'fr',
  de: 'de',
  sw: 'sw',
  oro: 'am', // Oromo -> Amharic (closest available)
  lug: 'lg', // Luganda (not directly available, will use closest)
  zu: 'zu', // Zulu
  it: 'it',
  nl: 'nl',
  da: 'da',
  pl: 'pl',
  hu: 'hu',
  tr: 'tr',
  ar: 'ar',
  zh: 'zh-CN',
  hi: 'hi',
  ru: 'ru',
  uk: 'uk',
  ro: 'ro',
  cs: 'cs',
  sk: 'sk',
  bg: 'bg',
  el: 'el',
};

// English source translations
const sourceTranslations: Record<string, string> = {
  app_title: 'GPExts',
  app_subtitle: 'Decision Support',
  dashboard_title: 'Intelligence Dashboard',
  dashboard_overview: 'Dashboard Overview',
  dashboard_welcome: "Welcome back, {name}! Here's your current performance.",
  urgent_signals: 'Urgent Priority Signals Active',
  impact_metrics: 'Impact Metrics',
  farmers_reached: 'Farmers Reached',
  queries_resolved: 'Queries Resolved',
  avg_response_time: 'Avg Response Time',
  regional_coverage: 'Regional Coverage',
  prioritized_visits: 'Prioritized Visit Portfolio',
  ai_advisory_hub: 'AI Advisory Hub',
  consult_kb: 'Consult Knowledge Base',
  signal_alerts: 'Signal Alerts',
  new_impact_report: 'New Impact Report',
  nav_dashboard: 'Dashboard',
  nav_farmers: 'Farmers',
  nav_visits: 'Visits',
  nav_knowledge: 'Knowledge',
  nav_analytics: 'Analytics',
  nav_reports: 'Reports',
  nav_settings: 'Settings',
  nav_logout: 'Logout',
  common_search: 'Search',
  common_filter: 'Filter',
  common_export: 'Export',
  common_save: 'Save',
  common_cancel: 'Cancel',
  common_delete: 'Delete',
  common_edit: 'Edit',
  common_add: 'Add',
  common_loading: 'Loading...',
  common_error: 'Error',
  common_success: 'Success',
  common_no_data: 'No data available',
  common_select_language: 'Select Language',
  farmers_title: 'Farmers',
  farmers_add: 'Add Farmer',
  farmers_name: 'Name',
  farmers_location: 'Location',
  farmers_phone: 'Phone',
  farmers_language: 'Preferred Language',
  farmers_crops: 'Crops',
  farmers_farm_size: 'Farm Size',
  portfolio_title: 'Farmer Portfolio',
  portfolio_subtitle: 'Manage and monitor your assigned farmers and their productivity.',
  visits_title: 'Visits',
  visits_schedule: 'Schedule Visit',
  visits_subtitle: 'Schedule, coordinate, and track on-site extension activities.',
  visits_completed: 'Completed',
  visits_pending: 'Pending',
  visits_cancelled: 'Cancelled',
  reports_title: 'Agricultural Reports',
  reports_subtitle: 'Generate and analyze detailed impact reports for your region.',
  reports_generate: 'Generate Report',
  analytics_title: 'Advanced Analytics',
  analytics_subtitle: 'Deep dive into extension performance and impact.',
  analytics_overview: 'Overview',
  knowledge_title: 'Knowledge Base',
  knowledge_subtitle:
    'Search our premium agricultural repository or ask the AI expert for guidance.',
  auth_login: 'Login',
  auth_logout: 'Logout',
  auth_username: 'Username',
  auth_password: 'Password',
  settings_title: 'Settings',
  settings_profile: 'Profile',
  settings_preferences: 'Preferences',
  settings_language: 'Language',
  settings_theme: 'Theme',
  nav_dashboard_label: 'Dashboard',
  nav_my_farm: 'My Farm',
  nav_ai_advisor: 'AI Advisor',
  nav_farmer_chat: 'Farmer Chat',
  nav_knowledge_base: 'Knowledge Base',
  nav_portfolio: 'Portfolio',
  nav_register_farmer: 'Register Farmer',
  nav_visit_ai: 'Visit AI Advisor',
  nav_reports_label: 'Reports',
  nav_analytics_label: 'Analytics',
};

/**
 * Translate a single text to target language
 */
export async function translateText(text: string, targetLang: string): Promise<string> {
  const targetCode = languageMap[targetLang] || targetLang;
  try {
    const result = await translate(text, targetCode);
    return result;
  } catch (error) {
    console.error(`Translation error for ${targetLang}:`, error);
    return text;
  }
}

/**
 * Translate all keys to a target language
 */
export async function translateToLanguage(targetLang: string): Promise<Record<string, string>> {
  const translations: Record<string, string> = {};

  for (const [key, value] of Object.entries(sourceTranslations)) {
    // Keep placeholders like {name} as-is
    const translated = await translateText(value, targetLang);
    translations[key] = translated;

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return translations;
}

/**
 * Generate all translations for all languages
 * Returns a formatted object ready to add to i18n.ts
 */
export async function generateAllTranslations(): Promise<Record<string, Record<string, string>>> {
  const allTranslations: Record<string, Record<string, string>> = {};

  const languages = Object.keys(languageMap);

  for (const lang of languages) {
    allTranslations[lang] = await translateToLanguage(lang);
  }

  return allTranslations;
}

declare global {
  interface Window {
    translationUtils: {
      translateText: typeof translateText;
      translateToLanguage: typeof translateToLanguage;
      generateAllTranslations: typeof generateAllTranslations;
    };
  }
}

// Export for use in console
if (typeof window !== 'undefined') {
  window.translationUtils = {
    translateText,
    translateToLanguage,
    generateAllTranslations,
  };
}
