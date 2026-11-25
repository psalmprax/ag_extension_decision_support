import request from 'supertest';
import app from '../app';
import { logger } from '../utils/logger';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), crit: jest.fn() },
}));

describe('truthfulness regressions', () => {
  it('does not claim an agent execution was started when the control plane is not wired', async () => {
    const response = await request(app)
      .post('/api/v1/ai/execute')
      .send({ agent: 'agent-zero' });

    expect([401, 403, 503, 501]).toContain(response.status);
    if (response.status === 501) {
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('AGENT_EXECUTION_NOT_WIRED');
    }
  });

  it('does not accept the legacy hardcoded WhatsApp verification token', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    process.env.NODE_ENV = 'development';
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;

    const response = await request(app)
      .get('/api/v1/whatsapp/inbound')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'ag_extension_dev_fallback_2026',
        'hub.challenge': 'challenge',
      });

    expect(response.status).toBe(503);
    process.env.NODE_ENV = originalNodeEnv;
    if (originalToken === undefined) delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    else process.env.META_WEBHOOK_VERIFY_TOKEN = originalToken;
  });

  it('says WhatsApp verification is not set up (503), not a server error, when production has no token', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    process.env.NODE_ENV = 'production';
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    try {
      const response = await request(app)
        .get('/api/v1/whatsapp/inbound')
        .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'anything', 'hub.challenge': 'challenge' });

      expect(response.status).toBe(503);
      expect(response.body.error).toMatch(/not configured/);
      expect(logger.crit).toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalToken === undefined) delete process.env.META_WEBHOOK_VERIFY_TOKEN;
      else process.env.META_WEBHOOK_VERIFY_TOKEN = originalToken;
    }
  });
});
