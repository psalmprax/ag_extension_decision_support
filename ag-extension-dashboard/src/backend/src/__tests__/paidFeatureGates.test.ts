import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { hashToken } from '@/services/sessionService';
import { usageService } from '@/services/usageService';
import { autonomousCampaignService } from '@/services/autonomousCampaignService';
import { regionalSkillService } from '@/services/regionalSkillService';
import conversationsRouter from '@/routes/chatbot/conversations';
import messagesRouter from '@/routes/chatbot/messages';
import campaignsRouter from '@/routes/autonomousCampaigns';
import smsRouter from '@/routes/sms';

jest.mock('@/services/databaseService', () => ({ getPool: jest.fn(() => ({})), query: jest.fn() }));
jest.mock('@/services/cacheService', () => ({ getCache: jest.fn(() => null) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/realtimeHub', () => ({ getRealtimeServer: jest.fn(() => null) }));
jest.mock('@/services/usageService', () => ({
  usageService: { isFreeUser: jest.fn(), checkLimit: jest.fn(), incrementUsage: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/services/autonomousCampaignService', () => ({
  autonomousCampaignService: { executeGoalCampaign: jest.fn() },
}));
jest.mock('@/services/regionalSkillService', () => ({
  regionalSkillService: { synthesizeSkillFromVisit: jest.fn() },
}));
jest.mock('@/services/dataGovernanceService', () => ({ getPrincipalTenantId: jest.fn().mockResolvedValue(null) }));
jest.mock('@/services/aiProvider/aiProvider', () => ({
  AIProviderFactory: { getProvider: jest.fn().mockResolvedValue({ generateText: jest.fn().mockResolvedValue({ text: 'Habari' }) }) },
}));

const mockQuery = jest.mocked(query);
const FREE_OFFICER = 'free-officer';
const PRO_OFFICER = 'pro-officer';
const sessions = new Set<string>();

function officerToken(userId: string): string {
  const token = jwt.sign(
    { userId, email: `${userId}@example.test`, role: 'extension_officer', jti: randomUUID() },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  sessions.add(hashToken(token));
  return token;
}

const app = express();
app.use(express.json());
app.use('/chatbot', conversationsRouter);
app.use('/chatbot', messagesRouter);
app.use('/campaigns', campaignsRouter);
app.use('/sms', smsRouter);

beforeEach(() => {
  sessions.clear();
  jest.clearAllMocks();
  mockQuery.mockImplementation((async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM user_sessions')) {
      const known = sessions.has(String(params[0]));
      return {
        rows: known ? [{ is_revoked: false, is_active: true, expires_at: new Date(Date.now() + 3_600_000) }] : [],
        rowCount: known ? 1 : 0,
      };
    }
    return { rows: [], rowCount: 0 };
  }) as unknown as typeof query);
  // The free plan: no paid features and a zero AI quota. Pro: allowed.
  jest.mocked(usageService.isFreeUser).mockImplementation(async userId => userId === FREE_OFFICER);
  jest.mocked(usageService.checkLimit).mockImplementation(async userId =>
    userId === FREE_OFFICER ? { allowed: false, current: 0, limit: 0 } : { allowed: true, current: 0, limit: 1000 }
  );
  jest.mocked(autonomousCampaignService.executeGoalCampaign).mockResolvedValue({ success: true } as never);
  jest.mocked(regionalSkillService.synthesizeSkillFromVisit).mockResolvedValue({ id: 'skill-1' } as never);
});

/** Every route behind a Pro page in the app, as a free user could call it directly. */
const PAID_ROUTES = [
  { name: 'list chats', method: 'get' as const, path: '/chatbot/conversations', body: undefined },
  { name: 'start a chat', method: 'post' as const, path: '/chatbot/conversations', body: { kind: 'officer_ai' } },
  { name: 'send a chat message', method: 'post' as const, path: '/chatbot/messages', body: { conversationId: 'c1', content: 'hi' } },
  { name: 'draft an outreach campaign', method: 'post' as const, path: '/campaigns/goal/draft', body: { goalPrompt: 'Armyworm alert' } },
  { name: 'run an outreach campaign', method: 'post' as const, path: '/campaigns/goal', body: { goalPrompt: 'Armyworm alert', message: 'Check your maize this week.' } },
  {
    name: 'synthesise a skill with AI',
    method: 'post' as const,
    path: '/campaigns/skills/synthesize',
    body: { region: 'Nakuru', crop: 'maize', topic: 'armyworm', findings: 'larvae in whorls' },
  },
  { name: 'translate with AI', method: 'post' as const, path: '/sms/translate', body: { text: 'Spray at dawn', targetLanguage: 'sw' } },
];

describe('paid features are refused to the free plan on the server, not just hidden in the app', () => {
  it.each(PAID_ROUTES)('a free officer cannot $name', async ({ method, path, body }) => {
    const res = await request(app)[method](path).set('Authorization', `Bearer ${officerToken(FREE_OFFICER)}`).send(body);

    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
    expect(autonomousCampaignService.executeGoalCampaign).not.toHaveBeenCalled();
    expect(regionalSkillService.synthesizeSkillFromVisit).not.toHaveBeenCalled();
  });

  it.each(PAID_ROUTES)('a Pro officer is not stopped by the plan check to $name', async ({ method, path, body }) => {
    const res = await request(app)[method](path).set('Authorization', `Bearer ${officerToken(PRO_OFFICER)}`).send(body);

    // Later validation or lookups may still answer (e.g. 404 for an unknown chat); never the plan gate.
    expect(res.body.upgradeRequired).toBeUndefined();
    expect(res.status).not.toBe(403);
  });
});
