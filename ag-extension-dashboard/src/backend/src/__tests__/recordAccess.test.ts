/**
 * Records that belong to a farmer (crop cycles, milestones, soil results) follow the
 * farmer's access rule: a person may reach them only for farmers they may see.
 */
const mockQuery = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import express from 'express';
import request from 'supertest';
import { FARMER_OF, requireRecordOfVisibleFarmer } from '@/services/access/farmerScope';
import { soilLabService } from '@/services/soilLabService';

const MZUZU_FARMER = '0f6c1a52-1111-4a5b-9c3d-000000000001';
const CYCLE = '0f6c1a52-2222-4a5b-9c3d-000000000002';
const officer = { userId: 'officer-mzuzu', role: 'extension_officer' };

/** The officer's own farmer is visible; every other farmer id is not. */
function answer(sql: string, params: unknown[]) {
  if (sql.startsWith('SELECT fl.farmer_id FROM crop_cycles')) return { rows: params[0] === CYCLE ? [{ farmer_id: MZUZU_FARMER }] : [] };
  if (sql.includes('FROM farmers f WHERE f.id = $1::uuid')) {
    return { rows: params[0] === MZUZU_FARMER && params.includes(officer.userId) ? [{ id: MZUZU_FARMER }] : [] };
  }
  if (sql.includes('FROM farmers f WHERE f.id = $1')) {
    return { rows: params[0] === MZUZU_FARMER && params.includes(officer.userId) ? [{ visible: 1 }] : [] };
  }
  if (sql.includes('FROM farmers f WHERE f.phone = $1')) {
    return { rows: params[0] === '+265991000001' && params.includes(officer.userId) ? [{ id: MZUZU_FARMER }] : [] };
  }
  return { rows: [] };
}

beforeEach(() => {
  mockQuery.mockReset().mockImplementation(async (sql: string, params: unknown[] = []) => answer(sql, params));
});

function appAs(user: { userId: string; role: string } | null) {
  const app = express();
  app.use((req, _res, next) => { if (user) (req as unknown as { user: typeof user }).user = user; next(); });
  app.get('/cycles/:id', requireRecordOfVisibleFarmer('id', FARMER_OF.cropCycle, 'Crop cycle not found'), (_req, res) => {
    res.json({ success: true });
  });
  return app;
}

describe('requireRecordOfVisibleFarmer', () => {
  it("lets the officer reach a crop cycle of their own farmer", async () => {
    expect((await request(appAs(officer)).get(`/cycles/${CYCLE}`)).status).toBe(200);
  });

  it("answers 404 to an officer for another officer's farmer", async () => {
    const res = await request(appAs({ userId: 'officer-nakuru', role: 'extension_officer' })).get(`/cycles/${CYCLE}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Crop cycle not found');
  });

  it('answers 404 for an unknown or malformed id, and 401 without a session', async () => {
    expect((await request(appAs(officer)).get('/cycles/0f6c1a52-9999-4a5b-9c3d-000000000009')).status).toBe(404);
    expect((await request(appAs(officer)).get('/cycles/not-a-uuid')).status).toBe(404);
    expect((await request(appAs(null)).get(`/cycles/${CYCLE}`)).status).toBe(401);
  });
});

describe('soilLabService.importRows', () => {
  const row = (farmerRef: string) => ({ farmerRef, labName: 'Lilongwe soil lab', ph: 5.6 });

  it("stores results only for the importer's farmers and reports the rest", async () => {
    const result = await soilLabService.importRows(
      [row(MZUZU_FARMER), row('+265991000001'), row('+254700000999'), row('0f6c1a52-3333-4a5b-9c3d-000000000003')],
      officer,
    );
    expect(result.imported).toBe(2);
    expect(result.unmatchedFarmers).toEqual(['+254700000999', '0f6c1a52-3333-4a5b-9c3d-000000000003']);
    const inserts = mockQuery.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO soil_lab_results'));
    expect(inserts).toHaveLength(2);
    expect(inserts.every(([, params]) => (params as unknown[])[0] === MZUZU_FARMER)).toBe(true);
  });
});
