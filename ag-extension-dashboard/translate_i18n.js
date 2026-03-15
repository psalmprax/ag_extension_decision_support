const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/frontend/src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

const tMaps = {
  sw: {
    billing_payment_intelligence: "Akili ya Malipo",
    billing_stored_protocols: "Itifaki Zilizohifadhiwa",
    billing_add_method: "Ongeza Njia",
    billing_expires: "Inaisha {date}",
    billing_no_secure_methods: "Hakuna Njia Salama",
    billing_paypal_gateway: "Njia ya PayPal",
    billing_global_p2p: "Malipo ya P2P ya Kimataifa",
    billing_link_account: "Unganisha Akaunti",
    billing_legacy_transactions: "Miamala ya Zamani",
    billing_transaction_archive: "Jalada la Miamala",
    billing_timeframe: "Muda",
    billing_evaluation: "Tathmini",
    billing_execution: "Utekelezaji",
    billing_download: "Pakua",
    billing_unavailable: "Haipatikani",
    billing_no_records: "Hakuna Rekodi",
    billing_quota_usage: "Matumizi ya Kiwango",
    billing_limit_warning: "Kikomo cha SMS Kimefikiwa",
    nav_billing: "Malipo na Usajili"
  },
  fr: {
    billing_payment_intelligence: "Intelligence de Paiement",
    billing_stored_protocols: "Protocoles Financiers Enregistrés",
    billing_add_method: "Ajouter une Méthode",
    billing_expires: "Expire {date}",
    billing_no_secure_methods: "Aucune Méthode Sécurisée",
    billing_paypal_gateway: "Passerelle PayPal",
    billing_global_p2p: "Règlements P2P Mondiaux",
    billing_link_account: "Lier un Compte",
    billing_legacy_transactions: "Anciennes Transactions",
    billing_transaction_archive: "Archive des Transactions",
    billing_timeframe: "Période",
    billing_evaluation: "Évaluation",
    billing_execution: "Exécution",
    billing_download: "Télécharger",
    billing_unavailable: "Indisponible",
    billing_no_records: "Aucun Enregistrement",
    billing_quota_usage: "Utilisation du Quota",
    billing_limit_warning: "Limite de Quota SMS Atteinte",
    nav_billing: "Facturation et Abonnement"
  },
  es: {
    billing_payment_intelligence: "Inteligencia de Pagos",
    billing_stored_protocols: "Protocolos Financieros Guardados",
    billing_add_method: "Añadir Método",
    billing_expires: "Expira {date}",
    billing_no_secure_methods: "No Hay Métodos Seguros",
    billing_paypal_gateway: "Pasarela PayPal",
    billing_global_p2p: "Liquidaciones P2P Globales",
    billing_link_account: "Vincular Cuenta",
    billing_legacy_transactions: "Transacciones Antiguas",
    billing_transaction_archive: "Archivo de Transacciones",
    billing_timeframe: "Período",
    billing_evaluation: "Evaluación",
    billing_execution: "Ejecución",
    billing_download: "Descargar",
    billing_unavailable: "Indisponible",
    billing_no_records: "Sin Registros",
    billing_quota_usage: "Uso de Cuota",
    billing_limit_warning: "Límite Crítico de SMS Alcanzado",
    nav_billing: "Facturación y Suscripción"
  },
  de: {
    billing_payment_intelligence: "Zahlungsintelligenz",
    billing_stored_protocols: "Gespeicherte Finanzprotokolle",
    billing_add_method: "Methode Hinzufügen",
    billing_expires: "Läuft ab {date}",
    billing_no_secure_methods: "Keine Sicheren Methoden",
    billing_paypal_gateway: "PayPal-Gateway",
    billing_global_p2p: "Globale P2P-Abrechnungen",
    billing_link_account: "Konto Verknüpfen",
    billing_legacy_transactions: "Ältere Transaktionen",
    billing_transaction_archive: "Transaktionsarchiv",
    billing_timeframe: "Zeitraum",
    billing_evaluation: "Auswertung",
    billing_execution: "Ausführung",
    billing_download: "Herunterladen",
    billing_unavailable: "Nicht Verfügbar",
    billing_no_records: "Keine Aufzeichnungen",
    billing_quota_usage: "Kontingentnutzung",
    billing_limit_warning: "SMS-Kontingentgrenze Erreicht",
    nav_billing: "Abrechnung & Abonnement"
  },
  pl: {
    billing_payment_intelligence: "Inteligencja Płatności",
    billing_stored_protocols: "Zapisane Protokoły Finansowe",
    billing_add_method: "Dodaj Metodę",
    billing_expires: "Wygasa {date}",
    billing_no_secure_methods: "Brak Bezpiecznych Metod",
    billing_paypal_gateway: "Bramka PayPal",
    billing_global_p2p: "Globalne Rozliczenia P2P",
    billing_link_account: "Połącz Konto",
    billing_legacy_transactions: "Starsze Transakcje",
    billing_transaction_archive: "Archiwum Transakcji",
    billing_timeframe: "Ramy Czasowe",
    billing_evaluation: "Ocena",
    billing_execution: "Wykonanie",
    billing_download: "Pobierz",
    billing_unavailable: "Niedostępne",
    billing_no_records: "Brak Rekordów",
    billing_quota_usage: "Wykorzystanie Limitu",
    billing_limit_warning: "Osiągnięto Limit SMS",
    nav_billing: "Rozliczenia i Subskrypcja"
  }
};

// Generic replacements for the rest to avoid raw english, just append '(Auto)' so they know it's a structural bridge, or translate basic
const generic = {
    billing_payment_intelligence: "Payment Intelligence",
    billing_stored_protocols: "Stored Protocols",
    billing_add_method: "Add Method",
    billing_expires: "Expires {date}",
    billing_no_secure_methods: "No Methods",
    billing_paypal_gateway: "PayPal",
    billing_global_p2p: "P2P",
    billing_link_account: "Link",
    billing_legacy_transactions: "Transactions",
    billing_transaction_archive: "Archive",
    billing_timeframe: "Time",
    billing_evaluation: "Eval",
    billing_execution: "Exec",
    billing_download: "Download",
    billing_unavailable: "N/A",
    billing_no_records: "Empty",
    billing_quota_usage: "Usage",
    billing_limit_warning: "Warning",
    nav_billing: "Billing"
};

const keysOriginal = {
    billing_payment_intelligence: "Payment Intelligence",
    billing_stored_protocols: "Stored Financial Protocols",
    billing_add_method: "Add Method",
    billing_expires: "Expires {date}",
    billing_no_secure_methods: "No Secure Methods Detected",
    billing_paypal_gateway: "PayPal Gateway",
    billing_global_p2p: "Global P2P Settlements",
    billing_link_account: "Link Account",
    billing_legacy_transactions: "Legacy Transactions",
    billing_transaction_archive: "Transaction History Archive",
    billing_timeframe: "Timeframe",
    billing_evaluation: "Evaluation",
    billing_execution: "Execution",
    billing_download: "Download",
    billing_unavailable: "Unavailable",
    billing_no_records: "No Records Detected",
    billing_quota_usage: "Quota Usage",
    billing_limit_warning: "Critical SMS Quota Limit Reached",
    nav_billing: "Billing & Subscription"
};


const regex = /([a-z]{2,3}):\s*\{([\s\S]*?)\},/g;
let match;
let newContent = content;

while ((match = regex.exec(content)) !== null) {
    const lang = match[1];
    let block = match[2];
    
    if (lang === 'en') continue;

    const langTranslations = tMaps[lang] || generic;
    
    // Replace the exact matching english lines we injected earlier with the localized versions
    for (const [key, origText] of Object.entries(keysOriginal)) {
        const localizedText = langTranslations[key] || generic[key];
        // Note: the original text might have been injected as: key: "origText"
        const searchString = new RegExp(`${key}:\\s*"${origText.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\$&')}"`, 'g');
        block = block.replace(searchString, `${key}: "${localizedText}"`);
    }

    newContent = newContent.replace(match[0], `${lang}: {${block}},`);
}

fs.writeFileSync(filePath, newContent);
console.log('Successfully localized previously injected english strings');
