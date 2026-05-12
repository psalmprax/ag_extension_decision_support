// Embedded translations for backend use (subset of frontend translations)
const embeddedTranslations: Record<string, string> = {
  "email_template_farmer_visit_confirmation_subject": "Farm Visit Confirmed - {{farmerName}} on {{visitDate}}",
  "email_template_disease_alert_subject": "⚠️ {{diseaseName}} Alert - {{region}} Region",
  "email_template_market_price_subject": "Market Price Update - {{cropName}} at {{price}}/{{unit}}",
  "email_template_weather_advisory_subject": "Weather Advisory - {{region}} ({{dateRange}})",
  "email_template_training_invitation_subject": "Training Invitation: {{trainingTopic}} on {{date}}",
  "email_template_farmer_visit_confirmation_body": "Dear {{officerName}},\n\nYour farm visit has been confirmed:\n\nFarmer: {{farmerName}}\nLocation: {{location}}\nDate: {{visitDate}}\nTime: {{visitTime}}\nPurpose: {{purpose}}\n\nPlease bring your field kit and ensure GPS tracking is enabled.\n\nBest regards,\nAg Extension Team",
  "email_template_disease_alert_body": "URGENT AGRICULTURAL ALERT\n\nA {{diseaseName}} outbreak has been detected in the {{region}} region.\n\nAffected Crops: {{affectedCrops}}\nSeverity: {{severity}}\nRecommended Actions:\n{{recommendations}}\n\nPlease inspect your fields immediately and report any signs of infection.\n\nContact your extension officer for assistance.",
  "email_template_market_price_body": "Dear Farmer,\n\nCurrent market prices for your area:\n\n{{priceTable}}\n\nMarket: {{marketName}}\nDate: {{date}}\n\nFor more details, visit your dashboard or contact your extension officer.",
  "email_template_weather_advisory_body": "Weather Advisory for {{region}}\n\nForecast Period: {{dateRange}}\n\n{{weatherSummary}}\n\nRecommendations:\n{{recommendations}}\n\nStay safe and plan your farming activities accordingly.",
  "email_template_training_invitation_body": "Dear {{recipientName}},\n\nYou are invited to attend a training session:\n\nTopic: {{trainingTopic}}\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}\nTrainer: {{trainerName}}\n\nAgenda:\n{{agenda}}\n\nPlease confirm your attendance by replying to this email.\n\nBest regards,\nAg Extension Training Team"
};

const translations: Record<string, string> = { ...embeddedTranslations };

export function loadTranslations(): void {
  console.log(`✅ Loaded ${Object.keys(translations).length} embedded translations`);
}

export function t(key: string, defaultValue?: string): string {
  return translations[key] || defaultValue || key;
}