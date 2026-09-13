/**
 * Duplicate-dispatch regression tests for scheduled SMS.
 *
 * Two dispatch paths race on the same scheduled_sms rows:
 *   1. BullMQ worker (workers/scheduledSmsWorker.ts)
 *   2. DB polling fallback (smsService.processScheduledSMS)
 *
 * The guard is an atomic conditional UPDATE ('pending' → 'sending'): the
 * loser of the race must affect 0 rows and skip the send entirely.
 */
process.env.NODE_ENV = 'test';

const mockQuery = jest.fn();
jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => null),
    query: mockQuery,
}));

import { processScheduledSmsJob } from '../workers/scheduledSmsWorker';
import { smsService } from '../services/smsService';
import { logger } from '../utils/logger';
import type { Job } from 'bullmq';

let sendSmsSpy: jest.SpyInstance;

const dbResult = (rowCount = 0, rows: unknown[] = []) => ({ rows, rowCount });

const makeJob = (data: Record<string, unknown>): Job<any> =>
    ({ id: 'job-1', data }) as unknown as Job<any>;

beforeEach(() => {
    mockQuery.mockReset();
    // Re-create the spy each test: afterEach's restoreAllMocks detaches the
    // previous spy, so reusing a module-level one would silently hit the real
    // sendSMS in every test after the first.
    sendSmsSpy = jest.spyOn(smsService, 'sendSMS').mockResolvedValue(true);
    // Logger methods chain (return the logger), so mocks must too.
    jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    jest.spyOn(logger, 'error').mockImplementation(() => logger);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('BullMQ worker: claim-before-send', () => {
    it('sends and finalizes to sent when the claim wins', async () => {
        mockQuery
            .mockResolvedValueOnce(dbResult(1))   // claim pending → sending
            .mockResolvedValueOnce(dbResult(1)); // finalize sending → sent

        await processScheduledSmsJob(makeJob({
            scheduledSmsId: 'sms-1', to: '+254711000111', message: 'hi', senderId: 'user-1', farmerId: null,
        }));

        expect(sendSmsSpy).toHaveBeenCalledTimes(1);
        const finalize = mockQuery.mock.calls[1][0] as string;
        expect(finalize).toContain('status = $1');
        expect(mockQuery.mock.calls[1][1][0]).toBe('sent');
    });

    it('skips the send entirely when another path won the claim (duplicate race)', async () => {
        mockQuery.mockResolvedValueOnce(dbResult(0)); // claim affects 0 rows

        await processScheduledSmsJob(makeJob({
            scheduledSmsId: 'sms-1', to: '+254711000111', message: 'hi', senderId: 'user-1', farmerId: null,
        }));

        expect(sendSmsSpy).not.toHaveBeenCalled();
        // Only the claim UPDATE ran — no status finalization for a row we don't own.
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('marks the row failed and rethrows when the provider send fails', async () => {
        sendSmsSpy.mockResolvedValue(false);
        mockQuery
            .mockResolvedValueOnce(dbResult(1))   // claim wins
            .mockResolvedValue(dbResult(1));      // finalize + markScheduledSmsFailed

        await expect(processScheduledSmsJob(makeJob({
            scheduledSmsId: 'sms-2', to: '+254711000112', message: 'hi', senderId: 'user-1', farmerId: null,
        }))).rejects.toThrow('SMS provider reported failure');

        const finalize = mockQuery.mock.calls[1][0] as string;
        expect(finalize).toContain('status = $1');
        expect(mockQuery.mock.calls[1][1][0]).toBe('failed');
    });

    it('claim is conditional on pending status (regression guard)', async () => {
        mockQuery.mockResolvedValueOnce(dbResult(0));

        await processScheduledSmsJob(makeJob({
            scheduledSmsId: 'sms-1', to: '+254711000111', message: 'hi', senderId: 'user-1', farmerId: null,
        }));

        const claimSql = mockQuery.mock.calls[0][0] as string;
        expect(claimSql).toMatch(/status = 'sending'/);
        expect(claimSql).toMatch(/status = 'pending'/);
    });
});

describe('polling fallback: processScheduledSMS', () => {
    const dueSms = { id: 'sms-1', phone_number: '+254711000111', message: 'hi', user_id: 'user-1' };

    it('claims each row before sending and counts successes', async () => {
        mockQuery
            .mockResolvedValueOnce(dbResult(0))          // stale-claim sweep
            .mockResolvedValueOnce(dbResult(0, [dueSms])) // select due rows
            .mockResolvedValueOnce(dbResult(1))          // claim sms-1
            .mockResolvedValueOnce(dbResult(1));         // finalize sent

        const n = await smsService.processScheduledSMS();

        expect(n).toBe(1);
        expect(sendSmsSpy).toHaveBeenCalledWith({ to: '+254711000111', message: 'hi', senderId: 'user-1' });
        const claimSql = mockQuery.mock.calls[2][0] as string;
        expect(claimSql).toMatch(/status = 'pending'/);
        expect(claimSql).toMatch(/status = 'sending'/);
    });

    it('does not double-send when a second row loses the claim race', async () => {
        const second = { ...dueSms, id: 'sms-2', phone_number: '+254711000112' };
        mockQuery
            .mockResolvedValueOnce(dbResult(0))
            .mockResolvedValueOnce(dbResult(0, [dueSms, second]))
            .mockResolvedValueOnce(dbResult(1))  // sms-1 claim wins
            .mockResolvedValueOnce(dbResult(1))  // sms-1 finalize
            .mockResolvedValueOnce(dbResult(0))  // sms-2 claim lost
            .mockResolvedValue(dbResult(1));

        const n = await smsService.processScheduledSMS();

        expect(n).toBe(1);
        expect(sendSmsSpy).toHaveBeenCalledTimes(1);
    });

    it('reclaims rows stuck in sending from a crashed sender', async () => {
        mockQuery
            .mockResolvedValueOnce(dbResult(2))  // reclaim sweep: 2 rows back to pending
            .mockResolvedValueOnce(dbResult(0, []));

        const n = await smsService.processScheduledSMS();

        expect(n).toBe(0);
        const reclaimSql = mockQuery.mock.calls[0][0] as string;
        expect(reclaimSql).toMatch(/status = 'sending'/);
        expect(reclaimSql).toMatch(/status = 'pending'/);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('reclaimed 2'),);
    });

    it('returns 0 and keeps polling alive when the batch query throws', async () => {
        mockQuery.mockRejectedValue(new Error('db down'));

        const n = await smsService.processScheduledSMS();

        expect(n).toBe(0);
        expect(logger.error).toHaveBeenCalled();
    });
});
