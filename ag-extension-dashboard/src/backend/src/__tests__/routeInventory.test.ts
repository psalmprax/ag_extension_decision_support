import fs from 'fs';

jest.mock('@/services/databaseService');

describe('the cross-region access test covers every GET route', () => {
    it('lists exactly the routes the API serves (run npm run routes:inventory after adding or removing one)', async () => {
        const { currentGetRoutes, ROUTE_LIST_FILE } = await import('@/utils/getRouteList');
        const listed = JSON.parse(fs.readFileSync(ROUTE_LIST_FILE, 'utf8')) as string[];
        expect(listed).toEqual(currentGetRoutes());
    });

    it('lists every route with its method for the no-server-errors test', async () => {
        const { currentAllRoutes, ALL_ROUTES_FILE } = await import('@/utils/getRouteList');
        const listed = JSON.parse(fs.readFileSync(ALL_ROUTES_FILE, 'utf8')) as string[];
        expect(listed).toEqual(currentAllRoutes());
    });
});

describe('route inventory', () => {
    it('walks nested routers and their mount paths', async () => {
        const express = (await import('express')).default;
        const { listRoutes } = await import('@/utils/routeInventory');
        const inner = express.Router();
        inner.get('/leaf', (_req, res) => res.end());
        const outer = express.Router();
        outer.get('/', (_req, res) => res.end());
        outer.use('/nested', inner);
        outer.post('/thing/:id', (_req, res) => res.end());
        expect(listRoutes(outer, '/api/v1/x').sort()).toEqual(['GET /api/v1/x', 'GET /api/v1/x/nested/leaf', 'POST /api/v1/x/thing/:id']);
    });
});
