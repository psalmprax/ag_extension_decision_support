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
    })
];
