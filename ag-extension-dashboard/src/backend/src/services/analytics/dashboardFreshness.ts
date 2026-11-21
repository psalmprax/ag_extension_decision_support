import type { NextFunction, Request, Response } from 'express';
import { cacheGet, cacheIncr } from '@/services/cacheService';
import { logger } from '@/utils/logger';

/**
 * The dashboard caches its figures for a few minutes. Every saved change to farmers,
 * visits or conversations moves this counter on, and the counter is part of the cache
 * key, so the next dashboard read is counted afresh instead of showing the old totals.
 */
const VERSION_KEY = 'analytics:dashboard:version';
const WRITES = /^\/api(?:\/v1)?\/(?:farmers|visits|chatbot|threads|farmer-threads)(?:\/|$)/;

export async function dashboardVersion(): Promise<string> {
    return (await cacheGet(VERSION_KEY)) ?? '0';
}

export function refreshDashboardAfterWrites(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && WRITES.test(req.originalUrl)) {
        res.on('finish', () => {
            if (res.statusCode >= 400) return;
            Promise.resolve()
                .then(() => cacheIncr(VERSION_KEY))
                .catch((error: unknown) => logger.warn('Could not mark the dashboard for a fresh count', { error }));
        });
    }
    next();
}
