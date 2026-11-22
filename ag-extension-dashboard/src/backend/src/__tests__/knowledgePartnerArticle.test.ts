/** A partner's published recording keeps its transcript and credit unless an administrator corrects it. */
const mockQuery = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args), getPool: () => ({}) }));
jest.mock('@/services/prismaService', () => ({
  getPrisma: () => ({ knowledgeArticle: { findUnique: mockFindUnique, update: mockUpdate } }),
}));
jest.mock('@/middleware/authorize', () => ({
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: jest.fn() } }));
jest.mock('@/services/knowledgeService', () => ({ KnowledgeService: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import express from 'express';
import request from 'supertest';
import articlesRouter from '@/routes/knowledge/articles';

const ARTICLE = '7a1d0c3e-1111-4a5b-9c3d-000000000001';

function appAs(role: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as unknown as { user: object }).user = { userId: 'u1', role }; next(); });
  app.use('/knowledge', articlesRouter);
  return app;
}

beforeEach(() => {
  mockQuery.mockReset().mockResolvedValue({ rows: [{ exists: 1 }] });
  mockFindUnique.mockReset().mockResolvedValue({ id: ARTICLE, contentType: 'text', title: 'Fall armyworm scouting' });
  mockUpdate.mockReset().mockImplementation(async ({ data }: { data: object }) => ({ id: ARTICLE, ...data }));
});

describe('PUT /knowledge/:id on a partner recording', () => {
  it('is refused to an officer and a manager, and changes nothing', async () => {
    for (const role of ['extension_officer', 'regional_manager']) {
      const res = await request(appAs(role)).put(`/knowledge/${ARTICLE}`).send({ source: 'Someone else' });
      expect(res.status).toBe(403);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('is allowed to an administrator', async () => {
    const res = await request(appAs('admin')).put(`/knowledge/${ARTICLE}`).send({ summary: 'Scout the funnel at dawn.' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
