import { Page } from '@playwright/test';

export const MOCK_USER = {
    id: 'demo-user-001',
    email: 'demo@agextension.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'extension_officer',
    region: 'Central',
};

export const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token';

export const MOCK_DASHBOARD = {
    success: true,
    data: {
        overview: {
            totalFarmers: 42,
            activeConversations: 8,
            visitsThisMonth: 12,
            avgSatisfaction: 4.5,
            avgConversationsPerFarmer: 2.3,
        },
        trends: {
            farmersGrowth: 12,
            conversationsGrowth: 8,
            visitsGrowth: -3,
            satisfactionChange: 0.2,
        },
        totalFarmers: 42,
        activeVisits: 12,
        pendingReports: 5,
        unreadNotifications: 3,
        recentActivities: [
            { id: '1', type: 'visit', description: 'Visit to Central region', date: new Date().toISOString() },
            { id: '2', type: 'farmer', description: 'New farmer registered', date: new Date().toISOString() },
        ],
    },
};

export const MOCK_FARMERS = {
    success: true,
    data: {
        farmers: [
            {
                id: 'farmer-001',
                firstName: 'John',
                lastName: 'Mwangi',
                phone: '+254712345678',
                region: 'Central',
                village: 'Kibwezi',
                crops: ['Maize', 'Beans'],
                farmSize: 5.2,
                status: 'active',
            },
            {
                id: 'farmer-002',
                firstName: 'Grace',
                lastName: 'Akinyi',
                phone: '+254798765432',
                region: 'Western',
                village: 'Busia',
                crops: ['Cassava', 'Sweet Potatoes'],
                farmSize: 3.0,
                status: 'active',
            },
        ],
    },
};

export const MOCK_VISITS = {
    success: true,
    data: {
        visits: [
            { id: 'visit-001', farmerId: 'farmer-001', farmerName: 'John Mwangi', date: new Date().toISOString(), status: 'completed', notes: 'Pest management' },
        ],
    },
};

export const MOCK_REPORTS = {
    success: true,
    data: {
        reports: [
            { id: 'report-001', title: 'Monthly Extension Report', type: 'synthesis', createdAt: new Date().toISOString(), status: 'completed' },
        ],
    },
};

export const MOCK_PERFORMANCE = {
    success: true,
    data: { visitsThisMonth: 45, farmersReached: 120, avgRating: 4.2, completionRate: 0.85 },
};

export const MOCK_TRANSACTIONS = {
    success: true,
    data: [],
};

// Note: Must reflect the specific origin (not '*') because apiClient uses withCredentials: true,
// and the CORS spec forbids wildcard origins with credentialed requests.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

// Helper to create mock response with CORS headers
const mockJson = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
});

// Map of API endpoint patterns to mock data
const API_MOCKS: Record<string, { status: number; body: unknown }> = {
    '/api/auth/demo': { status: 200, body: { success: true, data: { token: MOCK_TOKEN, user: MOCK_USER } } },
    '/api/auth/login': { status: 200, body: { success: true, data: { token: MOCK_TOKEN, user: MOCK_USER } } },
    '/api/auth/me': { status: 200, body: { success: true, data: MOCK_USER } },
    '/api/auth/logout': { status: 200, body: { success: true } },
    '/api/auth/register': { status: 200, body: { success: true, data: { token: MOCK_TOKEN, user: MOCK_USER } } },
    '/api/dashboard': { status: 200, body: MOCK_DASHBOARD },
    '/api/farmers': { status: 200, body: MOCK_FARMERS },
    '/api/visits': { status: 200, body: MOCK_VISITS },
    '/api/reports': { status: 200, body: MOCK_REPORTS },
    '/api/analytics/performance': { status: 200, body: MOCK_PERFORMANCE },
    '/api/billing/transactions': { status: 200, body: MOCK_TRANSACTIONS },
    '/api/notifications/unread-count': { status: 200, body: { success: true, data: { count: 0 } } },
    '/api/notifications': { status: 200, body: { success: true, data: [] } },
    '/health': { status: 200, body: { status: 'healthy', services: { database: 'connected', redis: 'connected' } } },
    '/api/upload': { status: 401, body: { success: false, error: 'Unauthorized' } },
    '/api/chat': { status: 200, body: { success: true, data: [] } },
    '/api/weather': { status: 200, body: { success: true, data: { temperature: 28, condition: 'Sunny', humidity: 65 } } },
    '/api/external/weather': { status: 200, body: { success: true, data: { temperature: 28, condition: 'Sunny', humidity: 65, location: 'Central' } } },
    '/api/analytics/dashboard': { status: 200, body: MOCK_DASHBOARD },
};

// Match an API URL path against our mock table. Returns longest matching path.
const findMock = (url: string): { status: number; body: unknown } | null => {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    // Try exact match first, then longest prefix match
    const matches = Object.keys(API_MOCKS).filter(k => path.startsWith(k));
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.length - a.length);
    return API_MOCKS[matches[0]];
};

/**
 * Sets up comprehensive API route mocks on a Playwright page.
 * Must be called BEFORE page.goto() to intercept initial requests.
 *
 * Uses host-based regex matching (by backend host) to avoid intercepting
 * Vite dev server module requests for files in src/api/.
 */
export async function setupApiMocks(page: Page) {
    // Single catch-all for ALL requests to the backend host.
    // This avoids intercepting Vite module requests entirely.
    await page.route(/localhost:7500/, async (route) => {
        const request = route.request();
        const method = request.method();

        // Handle CORS preflight
        if (method === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: CORS_HEADERS });
            return;
        }

        // Find matching mock for this endpoint
        try {
            const mock = findMock(request.url());
            if (mock) {
                await route.fulfill(mockJson(mock.body, mock.status));
                return;
            }
        } catch {
            // URL parsing failed — fall through to generic response
        }

        // Unmocked endpoint — return generic success to avoid network errors
        await route.fulfill(mockJson({ success: true, data: {} }));
    });
}

/**
 * Sets up API mocks, navigates to login, and clicks "Try the Demo" to authenticate.
 * Uses the app's normal login flow (API call → token → zustand hydration → dashboard render)
 * which is more reliable than localStorage hacks.
 */
export async function setupAuthenticatedPage(page: Page) {
    await setupApiMocks(page);
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // The button text may be the translated 'Try the Demo' or the raw key 'login_try_demo'
    // depending on whether translations have loaded. Match either.
    const demoBtn = page.locator('button').filter({ hasText: /login_try_demo|Try the Demo/i }).first();
    await demoBtn.waitFor({ state: 'visible', timeout: 30000 });
    await demoBtn.click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    // Wait for dashboard to fully render: heading shows 'Strategic Intelligence' (modern)
    // or 'Operations Dashboard' (classic). The sidebar button uses the same label.
    await page.locator('h1').filter({ hasText: /Strategic Intelligence|Operations Dashboard/i }).waitFor({ state: 'visible', timeout: 30000 });
}
