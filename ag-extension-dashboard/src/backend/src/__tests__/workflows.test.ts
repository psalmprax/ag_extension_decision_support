import request from 'supertest';
import app from '../app';
import { makeOfficerToken } from './helpers/setupMocks';

// Mock DB
jest.mock('../services/databaseService', () => ({
  initializeDatabase: jest.fn(),
  getPool: jest.fn(() => ({ query: jest.fn() })),
  query: jest.fn(),
}));

jest.mock('../services/cacheService', () => ({
  initializeDatabase: jest.fn(),
  getCache: jest.fn(() => null),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../middleware/authorize', () => ({
  authorize: () => (
    req: { user?: unknown; headers?: { authorization?: string } },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    if (!req.headers?.authorization) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    req.user = { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' };
    next();
  },
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  UserRole: ['admin', 'regional_manager', 'extension_officer', 'farmer'],
}));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

describe('Advisory Workflows API (/api/v1/workflows)', () => {
  let officerToken: string;

  beforeAll(() => {
    officerToken = makeOfficerToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/workflows lists workflows with status filter and pagination', async () => {
    const mockWorkflowRow = {
      id: 'wf-1',
      tenant_id: null,
      title: 'Maize Fall Armyworm Protocol',
      description: 'Standard IPM checklist',
      category: 'crop_protection',
      status: 'published',
      version: 2,
      steps_json: [
        { id: 'step-1', type: 'crop_selector', label: 'Select Crop', value: 'Maize' },
      ],
      created_by: 'off-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [mockWorkflowRow] });

    const res = await request(app)
      .get('/api/v1/workflows?status=published&category=crop_protection')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Maize Fall Armyworm Protocol');
    expect(res.body.data[0].stepsJson).toHaveLength(1);
  });

  it('POST /api/v1/workflows creates a new workflow in draft status', async () => {
    const newWorkflow = {
      id: 'wf-2',
      tenant_id: null,
      title: 'Acidic Soil Remediation Protocol',
      description: 'Lime calculation advisory workflow',
      category: 'soil_health',
      status: 'draft',
      version: 1,
      steps_json: [
        { id: 's1', type: 'soil_ph', label: 'Soil pH Gate', config: { targetPh: 6.5 } },
      ],
      created_by: 'off-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [newWorkflow] });

    const res = await request(app)
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        title: 'Acidic Soil Remediation Protocol',
        description: 'Lime calculation advisory workflow',
        category: 'soil_health',
        stepsJson: [
          { id: 's1', type: 'soil_ph', label: 'Soil pH Gate', config: { targetPh: 6.5 } },
        ],
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('wf-2');
    expect(res.body.data.status).toBe('draft');
  });

  it('GET /api/v1/workflows/:id returns 404 when workflow does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/v1/workflows/non-existent-id')
      .expect(404);

    expect(res.body.success).toBe(false);
  });

  it('PUT /api/v1/workflows/:id updates existing workflow', async () => {
    const existing = {
      id: 'wf-1',
      title: 'Old Title',
      description: 'Old Desc',
      category: 'general',
      status: 'draft',
      version: 1,
      steps_json: [],
    };

    const updated = {
      ...existing,
      title: 'Updated Title',
      steps_json: [{ id: 's1', type: 'dosage' }],
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [existing] }) // SELECT
      .mockResolvedValueOnce({ rows: [updated] }); // UPDATE

    const res = await request(app)
      .put('/api/v1/workflows/wf-1')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        title: 'Updated Title',
        stepsJson: [{ id: 's1', type: 'dosage' }],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('POST /api/v1/workflows/:id/publish bumps version and marks published', async () => {
    const published = {
      id: 'wf-1',
      title: 'Field Protocol',
      category: 'general',
      status: 'published',
      version: 2,
      steps_json: [],
      updated_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [published] });

    const res = await request(app)
      .post('/api/v1/workflows/wf-1/publish')
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.version).toBe(2);
  });
});
