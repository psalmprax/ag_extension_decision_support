import express from 'express';
import request from 'supertest';
import dataRightsRouter from '@/routes/dataRights';
import { query } from '@/services/databaseService';
import { auditDataAction, getFarmerForPrincipal } from '@/services/dataGovernanceService';
import { purgeStoredUpload } from '@/services/uploadService';

jest.mock('@/middleware/authorize', () => ({
  authorize: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'officer-1', role: 'extension_officer', email: 'officer@example.test', isDemo: false, tenantId: 'tenant-1' };
    next();
  },
}));
jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/dataGovernanceService', () => ({
  auditDataAction: jest.fn(async () => undefined),
  getFarmerForPrincipal: jest.fn(),
  principalFromRequest: (user: unknown) => user ?? null,
}));
jest.mock('@/services/uploadService', () => ({ purgeStoredUpload: jest.fn(async () => undefined) }));
jest.mock('@/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const mockQuery = jest.mocked(query);
const app = express();
app.use(express.json());
app.use('/data-rights', dataRightsRouter);

/** Answers each statement of the erasure by what it touches. */
function databaseWith(farmerFound: boolean) {
  mockQuery.mockImplementation((async (sql: string) => {
    if (sql.includes('UPDATE farmers')) return { rows: farmerFound ? [{ id: 'farmer-1', is_active: false }] : [], rowCount: farmerFound ? 1 : 0 };
    if (sql.includes('UPDATE chat_messages')) return { rows: [], rowCount: 3 };
    if (sql.includes('UPDATE upload_records')) return { rows: [{ storage_key: 'photo-1.png' }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }) as unknown as typeof query);
}

const statement = (fragment: string) => mockQuery.mock.calls.find(([sql]) => String(sql).includes(fragment));

describe('DELETE /data-rights/farmers/:farmerId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getFarmerForPrincipal).mockResolvedValue({ id: 'farmer-1', is_active: true } as Awaited<ReturnType<typeof getFarmerForPrincipal>>);
  });

  it('erases the farmer record, visit notes, photos and the farmer\'s conversations', async () => {
    databaseWith(true);
    const res = await request(app).delete('/data-rights/farmers/farmer-1').send({ confirm: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ farmerId: 'farmer-1', status: 'deleted' });
    expect(String(statement('UPDATE farmers')?.[0])).toContain("first_name = 'Deleted'");
    expect(statement('UPDATE visits SET notes = NULL')).toBeTruthy();
    expect(purgeStoredUpload).toHaveBeenCalledWith('photo-1.png');

    const [sql, params] = statement('UPDATE chat_messages') ?? [];
    expect(String(sql)).toContain('SELECT id FROM chat_conversations WHERE farmer_id = $1');
    expect(String(sql)).toContain("content = '[deleted]'");
    expect((params as unknown[])[0]).toBe('farmer-1');
    expect(JSON.parse((params as string[])[1])).toMatchObject({ deletedBy: 'officer-1', erasure: true });
    expect(auditDataAction).toHaveBeenCalledWith(expect.anything(), 'farmer_data_deleted', expect.objectContaining({ erasedMessages: 3, purgedUploads: 1 }));
  });

  it('needs an explicit confirmation, and erases nothing without it', async () => {
    databaseWith(true);
    const res = await request(app).delete('/data-rights/farmers/farmer-1').send({});
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('refuses a farmer the person may not see', async () => {
    jest.mocked(getFarmerForPrincipal).mockResolvedValue(null);
    databaseWith(true);
    const res = await request(app).delete('/data-rights/farmers/farmer-2').send({ confirm: true });
    expect(res.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('touches no conversation when the farmer is not found', async () => {
    databaseWith(false);
    const res = await request(app).delete('/data-rights/farmers/farmer-1').send({ confirm: true });
    expect(res.status).toBe(404);
    expect(statement('UPDATE chat_messages')).toBeUndefined();
  });
});
