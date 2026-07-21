import { OmniRouteService } from '../services/omniRouteService';

describe('OmniRouteService (Ported from money_time_revenue)', () => {
  it('should execute with failover to baseline offline provider if no keys configured', async () => {
    const messages = [{ role: 'user', content: 'What treatment is recommended for maize leaf blight?' }];

    const result = await OmniRouteService.executeWithFailover(messages);

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.providerUsed).toBeDefined();
  });
});
