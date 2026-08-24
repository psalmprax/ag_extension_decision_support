import { OmniRouteService } from '../services/omniRouteService';

describe('OmniRouteService (Ported from money_time_revenue)', () => {
  it('should reject when no candidate model can serve the request', async () => {
    const messages = [{ role: 'user', content: 'What treatment is recommended for maize leaf blight?' }];

    await expect(OmniRouteService.executeWithFailover(messages, [
      { providerName: 'ollama', model: 'local-test-model', score: 1, isFree: true },
    ])).rejects.toThrow(/exhausted/i);
  });

  it('must never return a fabricated offline diagnosis when all candidates fail', async () => {
    const messages = [{ role: 'user', content: 'Diagnose this leaf photo' }];

    try {
      await OmniRouteService.executeWithFailover(messages, [
        { providerName: 'openrouter', model: 'unavailable-model', score: 1, isFree: true },
      ]);
      throw new Error('expected executeWithFailover to reject');
    } catch (err) {
      expect((err as Error).message).not.toMatch(/fungal leaf spot|fallback diagnostic/i);
    }
  });
});
