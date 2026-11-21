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
    // An officer sees only their own farmers' locations.
    expect(executedSql).toMatch(/f\.assigned_officer_id = \$\d+/);
    expect(farmerQueryCall[1]).toContain('off-1');
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

describe('GET /api/worldmonitor/layers — pest swarm status', () => {
  // An empty pest map must never read as "no swarms" when there is no data source.
  const get = () => request(app).get('/api/worldmonitor/layers').set('Authorization', 'Bearer fake-jwt-token');
  const withPestQuery = (pest: () => Promise<unknown>) => mockQuery.mockImplementation((sql: string) =>
    (String(sql).includes('(armyworm|locust|quelea)') ? pest() : Promise.resolve({ rows: [] })));

  beforeEach(() => jest.clearAllMocks());

  it('reports "live" when the source was queried, even with zero clusters', async () => {
    withPestQuery(() => Promise.resolve({ rows: [] }));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data.pestSwarm).toEqual({ status: 'live', clusters: [], trajectories: [] });
  });

  it('clusters pest diagnoses from farms this officer may see', async () => {
    const near = (id: string, lat: string) => ({
      id, disease_label: 'Fall Armyworm', lat, lng: '36.80', district: 'Kiambu', created_at: '2026-11-20T08:00:00Z', role: 'extension_officer',
    });
    withPestQuery(() => Promise.resolve({ rows: [near('d-1', '-1.280'), near('d-2', '-1.285')] }));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data.pestSwarm.status).toBe('live');
    expect(res.body.data.pestSwarm.clusters).toHaveLength(1);
    expect(res.body.data.pestSwarm.clusters[0].pestType).toBe('fall_armyworm');
    const pestCall = mockQuery.mock.calls.find(c => String(c[0]).includes('(armyworm|locust|quelea)'));
    expect(String(pestCall?.[0])).toMatch(/f\.assigned_officer_id = \$\d+/);
  });

  it('reports "unavailable" and logs an error on any other failure', async () => {
    const { logger } = jest.requireMock('../utils/logger') as { logger: { error: jest.Mock } };
    withPestQuery(() => Promise.reject(Object.assign(new Error('connection terminated'), { code: '57P01' })));
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.data.pestSwarm.status).toBe('unavailable');
    expect(logger.error).toHaveBeenCalledWith('WorldMonitor pest swarm fetch failed:', expect.any(Error));
  });
});
