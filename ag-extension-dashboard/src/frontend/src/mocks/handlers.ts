import { http, HttpResponse } from 'msw';

export const handlers = [
    // Auth Mocks
    http.get('*/api/auth/me', () => {
        return HttpResponse.json({
            success: true,
            data: {
                id: '1',
                email: 'john@example.com',
                firstName: 'John',
                lastName: 'Doe',
                role: 'admin',
                region: 'Central'
            }
        });
    }),

    http.post('*/api/auth/login', () => {
        return HttpResponse.json({
            success: true,
            data: {
                user: {
                    id: '1',
                    email: 'john@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    role: 'admin'
                },
                token: 'mock-jwt-token'
            }
        });
    }),

    http.post('*/api/auth/demo', () => {
        return HttpResponse.json({
            success: true,
            data: {
                user: {
                    id: '1',
                    email: 'demo@example.com',
                    firstName: 'Demo',
                    lastName: 'User',
                    role: 'extension_officer'
                },
                token: 'mock-demo-token'
            }
        });
    }),

    // Dashboard & Analytics Mocks
    http.get('*/api/analytics/dashboard', () => {
        return HttpResponse.json({
            success: true,
            data: {
                overview: {
                    totalFarmers: 1250,
                    totalOfficers: 42,
                    activeConversations: 156,
                    visitsThisMonth: 89,
                    avgSatisfaction: 4.8,
                    queriesResolved: 432,
                    avgConversationsPerFarmer: 24
                },
                trends: {
                    farmersGrowth: 12,
                    conversationsGrowth: 8,
                    visitsGrowth: -5,
                    satisfactionChange: 2
                },
                timeline: [],
                geography: [
                    { region: 'North', count: 320 },
                    { region: 'Central', count: 580 },
                    { region: 'South', count: 350 }
                ],
                crops: [
                    { name: 'Maize', value: 400 },
                    { name: 'Tobacco', value: 300 },
                    { name: 'Groundnuts', value: 200 },
                    { name: 'Soybeans', value: 100 }
                ],
                recentActivity: [],
                priorityQueue: []
            }
        });
    }),

    // Billing Mocks
    http.get('*/api/billing/plans', () => {
        return HttpResponse.json({
            success: true,
            data: [
                { id: 'price_free', name: 'Free', price: 0, interval: 'month', features: ['Feature 1'] },
                { id: 'price_pro_monthly', name: 'Pro', price: 2900, interval: 'month', features: ['Feature 1', 'Feature 2'] }
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
                plan: { id: 'price_pro_monthly', name: 'Pro', price: 2900, interval: 'month', features: ['Feature 1', 'Feature 2'] }
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
                    { id: '1', firstName: 'John', lastName: 'Banda', latitude: -13.9626, longitude: 33.7741, region: 'Lilongwe', crops: ['maize'], location: 'Lilongwe Rural', phone: '+265880000001' },
                    { id: '2', firstName: 'Mary', lastName: 'Phiri', latitude: -15.7861, longitude: 35.0058, region: 'Blantyre', crops: ['tobacco'], location: 'Blantyre West', phone: '+265880000002' }
                ]
            }
        });
    }),

    // Weather Mocks
    http.get('*/api/external/weather', () => {
        return HttpResponse.json({
            success: true,
            data: {
                temp: 24,
                condition: 'Sunny',
                humidity: 65,
                windSpeed: 12
            }
        });
    }),

];
