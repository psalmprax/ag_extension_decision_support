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

describe('POST /api/v1/chatbot/import-session', () => {
  let officerToken: string;

  beforeAll(() => {
    officerToken = makeOfficerToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/v1/chatbot/import-session')
      .send({
        messages: [{ sender: 'user', text: 'Hello' }],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects payload with empty messages array with 400', async () => {
    const res = await request(app)
      .post('/api/v1/chatbot/import-session')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        messages: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('successfully imports public session into database and returns conversationId', async () => {
    const fakeConversationId = '11111111-2222-3333-4444-555555555555';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: fakeConversationId }] }) // INSERT chat_conversations
      .mockResolvedValueOnce({ rows: [{ id: 'msg-1' }] }) // INSERT msg 1
      .mockResolvedValueOnce({ rows: [{ id: 'msg-2' }] }); // INSERT msg 2

    const res = await request(app)
      .post('/api/v1/chatbot/import-session')
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        messages: [
          { sender: 'user', text: 'What is the bio-control for Fall Armyworm?' },
          { sender: 'assistant', text: 'Apply cold-pressed Neem oil at 3ml/L.' },
        ],
        entitySlots: {
          crop: 'Maize',
          pest_disease: 'Fall Armyworm',
          field_size: '3 acres',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversationId).toBe(fakeConversationId);
    expect(res.body.data.importedMessagesCount).toBe(2);
    expect(res.body.data.entitySlots.crop).toBe('Maize');
  });
});
