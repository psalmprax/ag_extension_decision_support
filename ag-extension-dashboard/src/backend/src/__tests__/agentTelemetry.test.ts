jest.mock('../services/databaseService', () => ({
    getPool: jest.fn(() => null),
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AgentTelemetry } from '../services/agentTelemetry';

describe('AgentTelemetry', () => {
    it('retains correlation IDs when database telemetry is unavailable', async () => {
        const telemetry = new AgentTelemetry();

        await telemetry.record({
            eventType: 'agent_request',
            agentId: 'openai',
            durationMs: 120,
            tokensUsed: 42,
            costUsd: 0.01,
            status: 'success',
            correlationId: 'corr-wave4-test',
        });

        const events = await telemetry.getRecentEvents();
        expect(events).toHaveLength(1);
        expect(events[0].correlationId).toBe('corr-wave4-test');
    });
});
