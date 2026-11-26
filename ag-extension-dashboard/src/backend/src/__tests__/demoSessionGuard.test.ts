jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => null),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
}));
jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => null),
}));
jest.mock('../services/sharedState', () => ({
    incrWindow: jest.fn().mockResolvedValue({ count: 1, resetAt: Date.now() + 60000 }),
    resetWindow: jest.fn(),
    getTtl: jest.fn().mockResolvedValue(null),
    setWithTtl: jest.fn(),
    setNx: jest.fn().mockResolvedValue(true),
    delKey: jest.fn(),
    addToSet: jest.fn().mockResolvedValue(undefined),
    inSet: jest.fn().mockResolvedValue(false),
    __resetSharedStateForTests: jest.fn(),
}));
jest.mock('../services/aiProvider/aiProvider', () => ({
    AIRouter: {
        routeRequest: jest.fn().mockResolvedValue({ text: 'assistant reply', providerUsed: 'mock', modelUsed: 'mock' }),
    },
    AIProviderFactory: {
        getPrimaryProvider: jest.fn(),
        getFallbackProvider: jest.fn(),
    },
    AI_CASCADE_FALLBACK: [],
}));
jest.mock('../services/ragV2Service', () => ({
    RAGV2Service: {
        enhancedSearch: jest.fn().mockResolvedValue({ results: [], citations: [] }),
    },
}));
jest.mock('../services/vectorService', () => ({
    VectorService: {
        hybridSearch: jest.fn().mockResolvedValue([]),
    },
}));
jest.mock('../services/mcpAdapter', () => ({
    createMCPRouter: jest.fn(() => jest.requireActual<typeof import('express')>('express').Router()),
    mcpAdapter: {
        convertToMCPTools: jest.fn().mockReturnValue([]),
        callTool: jest.fn(),
    },
}));
jest.mock('../middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import app from '../app';
import { apiEndpoint, demoSessionGuard, DEMO_READS, DEMO_WRITES, LEAVING_THE_DEMO } from '../middleware/demoSessionGuard';

const sign = (claims: Record<string, unknown>) =>
    jwt.sign(claims, config.jwt.secret as string, { expiresIn: '1h' });
const DEMO = sign({ userId: 'demo-1', email: 'demo@agridemo.com', role: 'extension_officer', isDemo: true });
const REAL = sign({ userId: 'off-1', email: 'off-1@test.dev', role: 'extension_officer' });

/** Every route group mounted in app.ts, read from the source so new routes are covered too. */
const mountedPaths = (() => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.ts'), 'utf8');
    const block = source.slice(source.indexOf('const routeMounts'), source.indexOf('];', source.indexOf('const routeMounts')));
    return [...block.matchAll(/path: '([^']+)'/g)].map(m => m[1]);
})();

const isGuardRefusal = (res: request.Response) => res.status === 403 && res.body?.code === 'DEMO_READ_ONLY';

describe('demo session guard', () => {
    it('normalises API paths the way Express routes them', () => {
        expect(apiEndpoint('/api/v1/farmers/')).toBe('/farmers');
        expect(apiEndpoint('/API/V1/Farmers')).toBe('/farmers');
        expect(apiEndpoint('/api//farmers')).toBe('/farmers');
        expect(apiEndpoint('/api')).toBe('/');
        expect(apiEndpoint('/health')).toBeNull();
    });

    it('finds the mounted routes to check', () => {
        expect(mountedPaths.length).toBeGreaterThan(40);
        expect(mountedPaths).toEqual(expect.arrayContaining(['/farmers', '/users', '/visits', '/sms']));
    });

    it('refuses the demo every mounted route group it does not use', async () => {
        const leaked: string[] = [];
        for (const mount of mountedPaths) {
            if (DEMO_READS.has(mount) || LEAVING_THE_DEMO.has(mount)) continue;
            const res = await request(app).get(`/api/v1${mount}`).set('Authorization', `Bearer ${DEMO}`);
            if (!isGuardRefusal(res)) leaked.push(`GET ${mount} -> ${res.status}`);
        }
        expect(leaked).toEqual([]);
    });

    it('refuses demo writes, including case and slash variants', async () => {
        for (const [method, url] of [
            ['post', '/api/v1/farmers'],
            ['patch', '/api/visits/v-1'],
            ['delete', '/api/v1/users/u-1'],
            ['post', '/API/V1/SMS/send'],
            ['post', '/api//campaigns'],
            ['get', '/api/v1/farmers/export'],
        ] as const) {
            const res = await request(app)[method](url).set('Authorization', `Bearer ${DEMO}`).send({});
            expect(isGuardRefusal(res)).toBe(true);
        }
    });

    it('lets the demo reach the endpoints its pages use', async () => {
        for (const endpoint of ['/auth/me', '/billing/plans', '/worldmonitor/layers', '/outbreaks']) {
            expect(DEMO_READS.has(endpoint)).toBe(true);
            const res = await request(app).get(`/api/v1${endpoint}`).set('Authorization', `Bearer ${DEMO}`);
            expect(isGuardRefusal(res)).toBe(false);
        }
        for (const endpoint of ['/auth/logout', '/chatbot/public-demo']) {
            expect(DEMO_WRITES.has(endpoint)).toBe(true);
            const res = await request(app).post(`/api${endpoint}`).set('Authorization', `Bearer ${DEMO}`).send({ message: 'hi' });
            expect(isGuardRefusal(res)).toBe(false);
        }
    });

    it('lets someone still in the demo sign in, sign up or reset a password', async () => {
        for (const endpoint of ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/phone/request']) {
            const res = await request(app).post(`/api${endpoint}`).set('Authorization', `Bearer ${DEMO}`).send({});
            expect({ endpoint, refusedAsDemo: isGuardRefusal(res) }).toEqual({ endpoint, refusedAsDemo: false });
        }
        const challenge = await request(app).get('/api/v1/auth/register/challenge').set('Authorization', `Bearer ${DEMO}`);
        expect(isGuardRefusal(challenge)).toBe(false);
    });

    it('decides on its own (no database) which ways out of the demo are open', () => {
        const guard = (method: string, path: string) => {
            const next = jest.fn();
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const req = { method, path, user: { userId: 'demo-1', email: 'demo@agridemo.com', role: 'extension_officer', isDemo: true } };
            demoSessionGuard(req as never, res as never, next);
            return next.mock.calls.length === 1 ? 'allowed' : `refused ${res.status.mock.calls[0]?.[0]}`;
        };
        expect(guard('POST', '/api/auth/login')).toBe('allowed');
        expect(guard('POST', '/api/v1/auth/register')).toBe('allowed');
        expect(guard('GET', '/api/auth/register/challenge')).toBe('allowed');
        expect(guard('POST', '/api/auth/resend-verification')).toBe('refused 403');
        expect(guard('POST', '/api/v1/farmers')).toBe('refused 403');
    });

    it('still refuses the demo resending a verification email for its own account', async () => {
        // A fresh demo session: an earlier test logs DEMO out, and a revoked session never reaches the guard.
        const demo = sign({ userId: 'demo-2', email: 'demo2@agridemo.com', role: 'extension_officer', isDemo: true });
        const res = await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${demo}`).send({});
        expect(isGuardRefusal(res)).toBe(true);
    });

    it('does not touch real accounts', async () => {
        const res = await request(app).get('/api/v1/farmers').set('Authorization', `Bearer ${REAL}`);
        expect(isGuardRefusal(res)).toBe(false);
    });
});
