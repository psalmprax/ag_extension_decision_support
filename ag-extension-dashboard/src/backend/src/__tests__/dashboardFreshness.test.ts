import { EventEmitter } from 'events';
import type { NextFunction, Request, Response } from 'express';

const mockIncr = jest.fn().mockResolvedValue(1);
const mockGet = jest.fn();
jest.mock('../services/cacheService', () => ({
    cacheIncr: (...args: unknown[]) => mockIncr(...args),
    cacheGet: (...args: unknown[]) => mockGet(...args),
}));
jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

import { dashboardVersion, refreshDashboardAfterWrites } from '../services/analytics/dashboardFreshness';

/** Runs the middleware for one request and finishes the response with the given status. */
async function finish(method: string, url: string, statusCode: number) {
    const res = Object.assign(new EventEmitter(), { statusCode }) as unknown as Response;
    const next = jest.fn() as NextFunction;
    refreshDashboardAfterWrites({ method, originalUrl: url } as Request, res, next);
    expect(next).toHaveBeenCalled();
    (res as unknown as EventEmitter).emit('finish');
    await new Promise(resolve => setImmediate(resolve));
}

describe('dashboard figures after a saved change', () => {
    beforeEach(() => mockIncr.mockClear());

    it('moves the version on after a farmer or visit is saved', async () => {
        await finish('DELETE', '/api/farmers/3f1e2d4c-5b6a-4987-8a1b-2c3d4e5f6a7b', 200);
        await finish('POST', '/api/v1/visits', 201);
        expect(mockIncr).toHaveBeenCalledTimes(2);
    });

    it('leaves it alone for reads, failed writes and unrelated routes', async () => {
        await finish('GET', '/api/farmers', 200);
        await finish('PATCH', '/api/farmers/x', 403);
        await finish('POST', '/api/knowledge/articles', 201);
        expect(mockIncr).not.toHaveBeenCalled();
    });

    it('reads version 0 when nothing has changed yet', async () => {
        mockGet.mockResolvedValueOnce(null);
        await expect(dashboardVersion()).resolves.toBe('0');
    });
});
