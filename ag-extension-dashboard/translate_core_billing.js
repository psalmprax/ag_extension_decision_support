const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/frontend/src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

const additionalKeysEn = {
    billing_title: "Billing & Subscription",
    billing_subtitle: "Manage your subscription, plans, and payment methods",
    billing_status_active: "Active",
    billing_status_canceled: "Canceled",
    billing_current_plan: "Current Plan",
    billing_features: "Features",
    billing_ai_messages: "AI Messages Used",
    billing_next_billing_date: "Next Billing Date",
    billing_renewal_date: "Renews on {date}",
    billing_manage_subscription: "Manage Subscription",
    billing_cancel_link: "Cancel Subscription",
    billing_portal_button: "Open Customer Portal",
    billing_select_plan: "Select Plan",
    billing_upgrade_plan: "Upgrade Plan",
    billing_plan_free: "Free",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Enterprise",
    billing_price_monthly: "{price}/month",
    billing_usage_metrics: "Usage Metrics"
};

const tMaps = {
  sw: {
    billing_title: "Malipo na Usajili",
    billing_subtitle: "Dhibiti usajili wako, mipango, na njia za malipo",
    billing_status_active: "Inafanya kazi",
    billing_status_canceled: "Imeghairiwa",
    billing_current_plan: "Mpango wa Sasa",
    billing_features: "Vipengele",
    billing_ai_messages: "Ujumbe wa AI Uliotumika",
    billing_next_billing_date: "Tarehe Inayofuata ya Malipo",
    billing_renewal_date: "Inasasishwa tarehe {date}",
    billing_manage_subscription: "Dhibiti Usajili",
    billing_cancel_link: "Ghairi Usajili",
    billing_portal_button: "Fungua Lango la Wateja",
    billing_select_plan: "Chagua Mpango",
    billing_upgrade_plan: "Boresha Mpango",
    billing_plan_free: "Bure",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Biashara",
    billing_price_monthly: "{price}/mwezi",
    billing_usage_metrics: "Vipimo vya Matumizi"
  },
  fr: {
    billing_title: "Facturation et Abonnement",
    billing_subtitle: "Gérez votre abonnement, vos forfaits et vos méthodes de paiement",
    billing_status_active: "Actif",
    billing_status_canceled: "Annulé",
    billing_current_plan: "Forfait Actuel",
    billing_features: "Caractéristiques",
    billing_ai_messages: "Messages IA Utilisés",
    billing_next_billing_date: "Prochaine Date de Facturation",
    billing_renewal_date: "Se renouvelle le {date}",
    billing_manage_subscription: "Gérer l'Abonnement",
    billing_cancel_link: "Annuler l'Abonnement",
    billing_portal_button: "Ouvrir le Portail Client",
    billing_select_plan: "Sélectionner le Forfait",
    billing_upgrade_plan: "Améliorer le Forfait",
    billing_plan_free: "Gratuit",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Entreprise",
    billing_price_monthly: "{price}/mois",
    billing_usage_metrics: "Métriques d'Utilisation"
  },
  es: {
    billing_title: "Facturación y Suscripción",
    billing_subtitle: "Gestiona tu suscripción, planes y métodos de pago",
    billing_status_active: "Activo",
    billing_status_canceled: "Cancelado",
    billing_current_plan: "Plan Actual",
    billing_features: "Características",
    billing_ai_messages: "Mensajes de IA Utilizados",
    billing_next_billing_date: "Próxima Fecha de Facturación",
    billing_renewal_date: "Se renueva el {date}",
    billing_manage_subscription: "Gestionar Suscripción",
    billing_cancel_link: "Cancelar Suscripción",
    billing_portal_button: "Abrir Portal del Cliente",
    billing_select_plan: "Seleccionar Plan",
    billing_upgrade_plan: "Mejorar Plan",
    billing_plan_free: "Gratis",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Empresa",
    billing_price_monthly: "{price}/mes",
    billing_usage_metrics: "Métricas de Uso"
  },
  de: {
    billing_title: "Abrechnung & Abonnement",
    billing_subtitle: "Verwalten Sie Ihr Abonnement, Ihre Pläne und Zahlungsmethoden",
    billing_status_active: "Aktiv",
    billing_status_canceled: "Storniert",
    billing_current_plan: "Aktueller Plan",
    billing_features: "Funktionen",
    billing_ai_messages: "Verwendete KI-Nachrichten",
    billing_next_billing_date: "Nächstes Abrechnungsdatum",
    billing_renewal_date: "Verlängert sich am {date}",
    billing_manage_subscription: "Abonnement Verwalten",
    billing_cancel_link: "Abonnement Kündigen",
    billing_portal_button: "Kundenportal Öffnen",
    billing_select_plan: "Plan Auswählen",
    billing_upgrade_plan: "Plan Aktualisieren",
    billing_plan_free: "Kostenlos",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Unternehmen",
    billing_price_monthly: "{price}/Monat",
    billing_usage_metrics: "Nutzungsmetriken"
  },
  pl: {
    billing_title: "Rozliczenia i Subskrypcja",
    billing_subtitle: "Zarządzaj swoją subskrypcją, planami i metodami płatności",
    billing_status_active: "Aktywny",
    billing_status_canceled: "Anulowano",
    billing_current_plan: "Obecny Plan",
    billing_features: "Funkcje",
    billing_ai_messages: "Wykorzystane Wiadomości AI",
    billing_next_billing_date: "Następna Data Rozliczenia",
    billing_renewal_date: "Odnawia się {date}",
    billing_manage_subscription: "Zarządzaj Subskrypcją",
    billing_cancel_link: "Anuluj Subskrypcję",
    billing_portal_button: "Otwórz Portal Klienta",
    billing_select_plan: "Wybierz Plan",
    billing_upgrade_plan: "Ulepsz Plan",
    billing_plan_free: "Darmowy",
    billing_plan_pro: "Pro",
    billing_plan_enterprise: "Przedsiębiorstwo",
    billing_price_monthly: "{price}/miesiąc",
    billing_usage_metrics: "Metryki Użycia"
  }
};

const regex = /([a-z]{2,3}):\s*\{([\s\S]*?)\},/g;
let match;
let newContent = content;

while ((match = regex.exec(content)) !== null) {
    const lang = match[1];
    let block = match[2];
    
    // We already have generic ones inserted for fallback on the backend, let's just insert these exact translations
    const langMaps = tMaps[lang] || additionalKeysEn;
    
    let added = false;
    for (const [key, value] of Object.entries(additionalKeysEn)) {
        if (!block.includes(`${key}:`)) {
            const localizedVal = langMaps[key] || value; // use english as fallback for unmapped languages
            block += `\n        ${key}: "${localizedVal}",`;
            added = true;
        }
    }
    
    if (added) {
        newContent = newContent.replace(match[0], `${lang}: {${block}\n    },`);
    }
}

fs.writeFileSync(filePath, newContent);
console.log('Successfully injected baseline billing localized strings into all languages');
