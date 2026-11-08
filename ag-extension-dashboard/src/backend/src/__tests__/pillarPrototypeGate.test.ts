import express from 'express';
import request from 'supertest';
import router from '@/routes/pillars/index';

jest.mock('@/middleware/authorize', () => ({
    authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/routes/pillars/traceability', () => require('express').Router());
jest.mock('@/routes/pillars/credit', () => require('express').Router());
jest.mock('@/routes/pillars/pest', () => require('express').Router());
jest.mock('@/routes/pillars/trade', () => require('express').Router());
jest.mock('@/routes/pillars/telemetry', () => require('express').Router());
jest.mock('@/routes/pillars/voice', () => require('express').Router());
jest.mock('@/routes/pillars/tenant', () => require('express').Router());
jest.mock('@/routes/pillars/mechanization', () => {
    const child = require('express').Router();
    child.post('/mechanization/search', (_req: unknown, res: express.Response) => res.json({ success: true }));
    return child;
});

const app = express();
app.use(router);

describe('prototype pillar deployment gate', () => {
    const oldEnv = process.env.NODE_ENV;
    const oldFlag = process.env.PILLARS_SPEC_ROUTES_ENABLED;
    afterEach(() => {
        process.env.NODE_ENV = oldEnv;
        if (oldFlag === undefined) delete process.env.PILLARS_SPEC_ROUTES_ENABLED;
        else process.env.PILLARS_SPEC_ROUTES_ENABLED = oldFlag;
    });

    it.each(['production', 'staging'])('does not expose prototypes in %s even with the sandbox flag', async environment => {
        process.env.NODE_ENV = environment;
        process.env.PILLARS_SPEC_ROUTES_ENABLED = 'true';
        const response = await request(app).post('/mechanization/search');
        expect(response.status).toBe(501);
        expect(response.body.errorCode).toBe('PILLAR_NOT_IMPLEMENTED');
    });

    it('allows explicitly enabled test sandboxes with prototype provenance', async () => {
        process.env.NODE_ENV = 'test';
        process.env.PILLARS_SPEC_ROUTES_ENABLED = 'true';
        const response = await request(app).post('/mechanization/search');
        expect(response.status).toBe(200);
        expect(response.body.dataStatus).toBe('specification_prototype');
    });

    it('keeps production allowlisted routes outside the prototype gate', async () => {
        process.env.NODE_ENV = 'production';
        const response = await request(app).post('/voice/transcribe');
        expect(response.status).not.toBe(501);
    });
});
