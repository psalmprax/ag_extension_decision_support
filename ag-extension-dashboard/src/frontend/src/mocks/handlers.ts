import { http, HttpResponse } from 'msw';

export const handlers = [
    // Auth Mocks
    http.get('*/api/auth/profile', () => {
        return HttpResponse.json({
            success: true,
            data: {
                id: 'user-123',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                role: 'extension_officer',
                region: 'Central'
            }
        });
    }),

    // Billing Mocks
    http.get('*/api/billing/plans', () => {
        return HttpResponse.json({
            success: true,
            data: [
                { id: 'plan_basic', name: 'Basic', price: 0, interval: 'month', features: ['Feature 1'] },
                { id: 'plan_pro', name: 'Pro', price: 2900, interval: 'month', features: ['Feature 1', 'Feature 2'] }
            ]
        });
    }),

    http.get('*/api/billing/subscription', () => {
        return HttpResponse.json({
            success: true,
            data: {
                id: 'sub_123',
                status: 'active',
                currentPeriodEnd: new Date(Date.now() + 86400000 * 30).toISOString(),
                cancelAtPeriodEnd: false,
                plan: { id: 'plan_pro', name: 'Pro', price: 2900, interval: 'month', features: ['Feature 1', 'Feature 2'] }
            }
        });
    }),

    http.get('*/api/billing/usage', () => {
        return HttpResponse.json({
            success: true,
            data: {
                smsCount: 15,
                aiChatCount: 8,
                reportCount: 2,
                limits: {
                    sms: 100,
                    ai: 50,
                    reports: 10
                }
            }
        });
    }),

    // Farmer Mocks
    http.get('*/api/farmers', () => {
        return HttpResponse.json({
            success: true,
            data: {
                farmers: [
                    { id: 'farmer-1', firstName: 'John', lastName: 'Doe', region: 'North' },
                    { id: 'farmer-2', firstName: 'Jane', lastName: 'Smith', region: 'South' }
                ]
            }
        });
    }),

    // Missing Billing Mocks
    http.get('*/api/billing/invoices', () => {
        return HttpResponse.json({
            success: true,
            data: []
        });
    }),

    http.get('*/api/billing/payment-methods', () => {
        return HttpResponse.json({
            success: true,
            data: []
        });
    }),

    // Locale Mocks
    http.get('*/locales/:lang.json', ({ params }) => {
        const { lang } = params;
        if (lang === 'sw') {
            return HttpResponse.json({
                test_key: 'Jaribio la Kiswahili',
                billing_title: 'Billing Intelligence',
                billing_account_control: 'Account Control',
                billing_subtitle: 'Manage your subscription',
                billing_promo_title: 'Pro Plan',
                billing_promo_desc: 'Upgrade now',
                billing_instant_activation: 'Instant Activation',
                billing_payment_intelligence: 'Payment Intelligence',
                billing_admin_vault_title: 'Admin Vault',
                billing_legacy_transactions: 'Legacy Transactions',
                billing_add_method: 'Add Method',
                billing_link_account: 'Link Account',
                billing_update_credentials: 'Update Credentials',
                billing_timeframe: 'Timeframe',
                billing_evaluation: 'Evaluation',
                billing_execution: 'Execution',
                billing_download: 'Download',
                billing_no_records: 'No records found',
                billing_current_plan: 'Current Plan',
                billing_status_label: 'Status',
                billing_status_active: 'Active',
                billing_renews_on: 'Renews on',
                billing_manage_subscription: 'Manage Subscription',
                plan_tier_operational: 'Operational',
                billing_select_plan: 'Select Plan',
                'Feature 1': 'Feature 1',
                'Feature 2': 'Feature 2',
                billing_stored_protocols: 'Stored Protocols',
                billing_no_secure_methods: 'No Secure Methods',
                billing_paypal_gateway: 'PayPal Gateway',
                billing_global_p2p: 'Global P2P',
                billing_admin_vault_subtitle: 'Secure Configuration',
                billing_stripe_id: 'Stripe ID',
                billing_paypal_id: 'PayPal ID',
                billing_test_mode: 'Test Mode',
                billing_transaction_archive: 'Archive',
                usage_init_title: 'Usage Intelligence',
                usage_init_desc: 'Real-time usage tracking'
            });
        }
        // Default to English
        return HttpResponse.json({
            test_key: 'Test English',
            billing_title: 'Billing Intelligence',
            billing_account_control: 'Account Control',
            billing_subtitle: 'Manage your subscription',
            billing_promo_title: 'Pro Plan',
            billing_promo_desc: 'Upgrade now',
            billing_instant_activation: 'Instant Activation',
            billing_payment_intelligence: 'Payment Intelligence',
            billing_admin_vault_title: 'Admin Vault',
            billing_legacy_transactions: 'Legacy Transactions',
            billing_add_method: 'Add Method',
            billing_link_account: 'Link Account',
            billing_update_credentials: 'Update Credentials',
            billing_timeframe: 'Timeframe',
            billing_evaluation: 'Evaluation',
            billing_execution: 'Execution',
            billing_download: 'Download',
            billing_no_records: 'No records found',
            billing_current_plan: 'Current Plan',
            billing_status_label: 'Status',
            billing_status_active: 'Active',
            billing_renews_on: 'Renews on',
            billing_manage_subscription: 'Manage Subscription',
            plan_tier_operational: 'Operational',
            billing_select_plan: 'Select Plan',
            'Feature 1': 'Feature 1',
            'Feature 2': 'Feature 2',
            billing_stored_protocols: 'Stored Protocols',
            billing_no_secure_methods: 'No Secure Methods',
            billing_paypal_gateway: 'PayPal Gateway',
            billing_global_p2p: 'Global P2P',
            billing_admin_vault_subtitle: 'Secure Configuration',
            billing_stripe_id: 'Stripe ID',
            billing_paypal_id: 'PayPal ID',
            billing_test_mode: 'Test Mode',
            billing_transaction_archive: 'Archive',
            usage_init_title: 'Usage Intelligence',
            usage_init_desc: 'Real-time usage tracking'
        });
    })
];
