/**
 * Soil tests and NASA POWER weather for one field: who may read and change them, and what
 * happens when the field has no location or NASA POWER cannot be reached.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const FARMER = '11111111-1111-1111-1111-111111111111';
const FIELD = '22222222-2222-2222-2222-222222222222';
const UNLOCATED_FIELD = '33333333-3333-3333-3333-333333333333';
const TEST_ID = '44444444-4444-4444-4444-444444444444';
/** A result id another field's record already has. */
const TAKEN_ID = '66666666-6666-6666-6666-666666666666';

const soilRow = (overrides: Record<string, unknown> = {}) => ({
    id: TEST_ID, field_id: FIELD, lab_name: 'KALRO', sample_ref: null, ph: '6.10', organic_carbon_pct: '1.80', organic_matter_pct: null,
    nitrogen_ppm: null, phosphorus_ppm: null, potassium_ppm: null, tested_at: '2026-03-14', ...overrides,
});
const rows = (list: unknown[]) => ({ rows: list, rowCount: list.length });

/** The soil_lab_results statements; undefined for any other SQL. */
function soilLabQuery(sql: string, params: unknown[]) {
    if (sql.startsWith('INSERT INTO soil_lab_results')) {
        // TEST_ID and TAKEN_ID are already saved, so ON CONFLICT (id) DO NOTHING inserts nothing.
        if (params[0] === TEST_ID || params[0] === TAKEN_ID) return rows([]);
        return rows([soilRow({ id: params[0] ?? TEST_ID, lab_name: params[3] })]);
    }
    if (sql.includes('FROM soil_lab_results WHERE id = $1 AND field_id = $2')) {
        return rows(params[0] === TEST_ID && params[1] === FIELD ? [soilRow()] : []);
    }
    if (sql.includes('FROM soil_lab_results WHERE field_id')) {
        return rows([soilRow({ ph: '5.90', organic_carbon_pct: '1.50', tested_at: new Date(2025, 2, 14) })]);
    }
    if (sql.startsWith('DELETE FROM soil_lab_results')) return { rows: [], rowCount: params[0] === TEST_ID ? 1 : 0 };
    return undefined;
}

const dbQuery = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM farmers f WHERE f.id = $1')) {
        const [farmerId, ...scope] = params;
        return rows(farmerId === FARMER && (scope.length === 0 || scope.includes('farm-1')) ? [{ visible: 1 }] : []);
    }
    if (sql.includes('FROM user_sessions')) return rows([{ is_revoked: false, is_active: true, expires_at: '2099-01-01T00:00:00Z' }]);
    return soilLabQuery(sql, params) ?? rows([]);
});

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => null),
    query: (sql: string, params?: unknown[]) => dbQuery(sql, params),
}));
jest.mock('../services/cacheService', () => ({ initializeCache: jest.fn(), getCache: jest.fn(() => ({ isOpen: true, get: jest.fn(), set: jest.fn() })) }));
jest.mock('../services/prismaService', () => ({
    getPrisma: jest.fn(() => ({
        systemConfig: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
        field: {
            findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
                if (where.id === FIELD) return { id: FIELD, farmerId: FARMER, isActive: true, latitude: '-0.303100', longitude: '36.080000' };
                if (where.id === UNLOCATED_FIELD) return { id: UNLOCATED_FIELD, farmerId: FARMER, isActive: true, latitude: null, longitude: null };
                return null;
            }),
        },
    })),
}));
const getDaily = jest.fn();
jest.mock('../services/nasaPowerService', () => ({ NasaPowerService: { getDaily: (...a: unknown[]) => getDaily(...a) } }));

import app from '../app';

const token = (userId: string, role: string, extra: Record<string, unknown> = {}) =>
    `Bearer ${jwt.sign({ userId, role, email: `${userId}@example.com`, ...extra }, config.jwt.secret, { expiresIn: '1h' })}`;
const farmer = token('farm-1', 'farmer');
const stranger = token('other-1', 'farmer');

describe('field soil tests', () => {
    it('lists a field\'s results as days with numbers', async () => {
        const res = await request(app).get(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer);
        expect(res.status).toBe(200);
        expect(res.body.data[0]).toMatchObject({ testedAt: '2025-03-14', ph: 5.9, organicCarbonPct: 1.5, labName: 'KALRO' });
    });

    it('saves a result the farmer enters', async () => {
        const res = await request(app)
            .post(`/api/v1/fields/${FIELD}/soil-tests`)
            .set('Authorization', farmer)
            .send({ testedAt: '2026-03-14', labName: 'KALRO', ph: 6.1, organicCarbonPct: 1.8 });
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ organicCarbonPct: 1.8, testedAt: '2026-03-14' });
    });

    it('needs at least one measurement and a date that has happened', async () => {
        const empty = await request(app).post(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer).send({ testedAt: '2026-03-14' });
        expect(empty.status).toBe(400);
        expect(empty.body.error).toMatch(/at least one measurement/);
        const future = await request(app).post(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer).send({ testedAt: '2099-01-01', ph: 6 });
        expect(future.status).toBe(400);
        expect(future.body.error).toMatch(/future/);
    });

    it('hides another farmer\'s field', async () => {
        const res = await request(app).get(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', stranger);
        expect(res.status).toBe(404);
    });

    it('keeps demo sessions from changing results', async () => {
        const res = await request(app)
            .post(`/api/v1/fields/${FIELD}/soil-tests`)
            .set('Authorization', token('farm-1', 'farmer', { isDemo: true }))
            .send({ testedAt: '2026-03-14', ph: 6 });
        expect(res.status).toBe(403);
    });

    it('keeps one copy of a result saved offline and sent again', async () => {
        const input = { id: TEST_ID, testedAt: '2026-03-14', labName: 'KALRO', ph: 6.1 };
        const res = await request(app).post(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer).send(input);
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ id: TEST_ID, ph: 6.1 });
    });

    it('saves a new result under the id the device chose, and refuses an id another record has', async () => {
        const fresh = '77777777-7777-4777-8777-777777777777';
        const saved = await request(app).post(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer).send({ id: fresh, testedAt: '2026-03-14', ph: 6.1 });
        expect(saved.status).toBe(201);
        expect(saved.body.data.id).toBe(fresh);
        const taken = await request(app).post(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer).send({ id: TAKEN_ID, testedAt: '2026-03-14', ph: 6.1 });
        expect(taken.status).toBe(409);
        const notAnId = await request(app).post(`/api/v1/fields/${FIELD}/soil-tests`).set('Authorization', farmer).send({ id: 'abc', testedAt: '2026-03-14', ph: 6.1 });
        expect(notAnId.status).toBe(400);
    });

    it('deletes one result, and says so when there is no such result', async () => {
        expect((await request(app).delete(`/api/v1/fields/${FIELD}/soil-tests/${TEST_ID}`).set('Authorization', farmer)).status).toBe(200);
        expect((await request(app).delete(`/api/v1/fields/${FIELD}/soil-tests/55555555-5555-5555-5555-555555555555`).set('Authorization', farmer)).status).toBe(404);
    });
});

describe('field weather', () => {
    beforeEach(() => getDaily.mockReset());

    it('returns daily solar radiation and rainfall up to the last day NASA POWER has published', async () => {
        getDaily.mockResolvedValue([
            { date: '2026-11-18', ALLSKY_SFC_SW_DWN: 21.4, PRECTOTCORR: 3.2 },
            { date: '2026-11-19', ALLSKY_SFC_SW_DWN: 18.9, PRECTOTCORR: 0 },
            { date: '2026-11-20', PRECTOTCORR: 1.1 },
        ]);
        const res = await request(app).get(`/api/v1/fields/${FIELD}/weather`).set('Authorization', farmer);
        expect(res.status).toBe(200);
        expect(getDaily).toHaveBeenCalledWith(-0.3031, 36.08, expect.any(String), expect.any(String), ['ALLSKY_SFC_SW_DWN', 'PRECTOTCORR']);
        expect(res.body.data.units).toEqual({ solar: 'MJ/m²/day', rain: 'mm/day' });
        expect(res.body.data.latestDate).toBe('2026-11-20');
        expect(res.body.data.days[2]).toEqual({ date: '2026-11-20', solarMjM2: null, rainMm: 1.1 });
    });

    it('asks for a location first', async () => {
        const res = await request(app).get(`/api/v1/fields/${UNLOCATED_FIELD}/weather`).set('Authorization', farmer);
        expect(res.status).toBe(409);
        expect(getDaily).not.toHaveBeenCalled();
    });

    it('says when NASA POWER cannot be reached', async () => {
        getDaily.mockResolvedValue([]);
        const res = await request(app).get(`/api/v1/fields/${FIELD}/weather`).set('Authorization', farmer);
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/NASA POWER/);
    });
});
