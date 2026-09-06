import request from 'supertest';
import app from '../app';

jest.mock('../services/databaseService', () => ({
  initializeDatabase: jest.fn(),
  getPool: jest.fn(() => ({ query: jest.fn() })),
  query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
  initializeCache: jest.fn(),
  getCache: jest.fn(() => null),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../middleware/authorize', () => ({
  authorize: () => (req: { user?: unknown; headers?: { authorization?: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
    if (!req.headers?.authorization) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    req.user = { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' };
    next();
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  AuthRequest: jest.fn(),
  UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

jest.mock('../services/soilGridsService', () => ({
  SoilGridsService: {
    fetchBaseline: jest.fn().mockResolvedValue({ ph: 6.2, organicCarbonGPerKg: 14.5 }),
  },
}));

jest.mock('../services/openMeteoSoilService', () => ({
  OpenMeteoSoilService: {
    fetchSnapshot: jest.fn().mockResolvedValue({ soilMoisture: { avgTop9cm: 0.28 } }),
  },
}));

jest.mock('../services/pestSwarmRadarService', () => ({
  clusterPestSightings: jest.fn().mockReturnValue([]),
}));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

describe('GET /api/worldmonitor/layers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with layers when called with no query parameters', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM farmers f')) {
        return Promise.resolve({
          rows: [
            {
              id: 'f-1',
              lat: '-1.286389',
              lng: '36.817223',
              region: 'Central',
              district: 'Kiambu',
              crops: ['Maize', 'Beans'],
            },
          ],
        });
      }
      if (sql.includes('FROM diagnosis_events d')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM pest_sightings')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/worldmonitor/layers?')
      .set('Authorization', 'Bearer fake-jwt-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.farmers).toHaveLength(1);
    expect(res.body.data.farmers[0].id).toBe('f-1');
    expect(res.body.data.satelliteOrbit.live).toBe(false);

    // Verify SQL generated for farmers does NOT have syntax error 'FROM farmers f  AND'
    const farmerQueryCall = mockQuery.mock.calls.find(c => String(c[0]).includes('FROM farmers f'));
    expect(farmerQueryCall).toBeDefined();
    const executedSql = String(farmerQueryCall[0]);
    expect(executedSql).toContain('WHERE');
    expect(executedSql).not.toMatch(/FROM farmers f\s+AND/);
  });

  it('should return 200 with filtered layers when called with filters', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/api/worldmonitor/layers?region=RiftValley&crop=Wheat&county=Nakuru&limit=50')
      .set('Authorization', 'Bearer fake-jwt-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.filters.region).toBe('RiftValley');
    expect(res.body.data.filters.crop).toBe('Wheat');
    expect(res.body.data.filters.county).toBe('Nakuru');
  });
});
