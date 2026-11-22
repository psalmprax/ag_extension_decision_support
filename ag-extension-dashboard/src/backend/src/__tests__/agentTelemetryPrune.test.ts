const mockQuery = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args), getPool: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { agentTelemetry } from '@/services/agentTelemetry';

describe('AI telemetry retention', () => {
    beforeEach(() => mockQuery.mockReset());

    it('deletes in slices until the backlog past the window is gone', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 10_000 }).mockResolvedValueOnce({ rowCount: 10_000 }).mockResolvedValueOnce({ rowCount: 42 });
        await expect(agentTelemetry.prune(30)).resolves.toBe(20_042);
        expect(mockQuery).toHaveBeenCalledTimes(3);
        expect(mockQuery.mock.calls[0][1]).toEqual([30, 10_000]);
    });

    it('falls back to 90 days for a missing or nonsensical window', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0 });
        await agentTelemetry.prune(-5);
        expect(mockQuery.mock.calls[0][1]).toEqual([90, 10_000]);
    });
});
