const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/frontend/src/lib/i18n.ts');
let content = fs.readFileSync(filePath, 'utf8');

const keysToAdd = {
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
    billing_limit_warning: "Critical SMS Quota Limit Reached"
};

// Use regex to find all language blocks
const regex = /([a-z]{2,3}):\s*\{([\s\S]*?)\},/g;
let match;
let newContent = content;

while ((match = regex.exec(content)) !== null) {
    const lang = match[1];
    let block = match[2];
    
    let added = false;
    for (const [key, value] of Object.entries(keysToAdd)) {
        if (!block.includes(key)) {
            // Append it before the final brace of the block - wait, we replace the block
            block += `\n        ${key}: "${value}",`;
            added = true;
        }
    }
    
    if (added) {
        newContent = newContent.replace(match[0], `${lang}: {${block}\n    },`);
    }
}

fs.writeFileSync(filePath, newContent);
console.log('Appended missing keys to all languages');
