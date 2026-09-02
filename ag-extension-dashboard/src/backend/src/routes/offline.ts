import { Router, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { getPrisma } from '@/services/prismaService';

const router = Router();

// The offline sync queue + dead-letter store are persisted in the
// offline_queue_items table so entries survive process restarts and are visible
// across multiple API instances. The legacy in-memory Maps lost every queued
// item on deploy.

const QUEUE_STATES = ['pending', 'failed', 'conflict', 'dead_letter'] as const;
type QueueState = (typeof QUEUE_STATES)[number];

function normalizeState(raw: unknown): QueueState {
    return QUEUE_STATES.includes(raw as QueueState) ? (raw as QueueState) : 'pending';
}

/**
 * POST /api/v1/offline/queue
 * Upsert a queued request from the browser extension into the durable queue.
 * The extension's own IndexedDB queue remains the source of truth for replay;
 * this endpoint mirrors queue state server-side so retry/delete/status survive
 * extension reinstates and work across devices.
 */
router.post('/queue', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const body = req.body as {
            id?: string;
            idempotencyKey?: string;
            url?: string;
            method?: string;
            headers?: Record<string, string>;
            body?: string | Record<string, unknown>;
            attachmentRefs?: string[];
            retries?: number;
            maxRetries?: number;
            state?: string;
            lastError?: string;
        };

        if (!body.id || !body.url || !body.method) {
            return safeError(res, 400, 'id, url and method are required');
        }

        // Authorization header is never persisted — the server injects the
        // caller's own token when replaying.
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(body.headers || {})) {
            if (key.toLowerCase() !== 'authorization') headers[key] = String(value);
        }

        const item = await getPrisma().offlineQueueItem.upsert({
            where: { userId_clientRequestId: { userId, clientRequestId: body.id } },
            update: {
                url: body.url,
                method: body.method,
                headers,
                body: (body.body ?? undefined) as never,
                attachmentRefs: body.attachmentRefs || [],
                retries: body.retries ?? 0,
                maxRetries: body.maxRetries ?? 3,
                state: normalizeState(body.state),
                lastError: body.lastError,
            },
            create: {
                userId,
                clientRequestId: body.id,
                idempotencyKey: body.idempotencyKey || body.id,
                url: body.url,
                method: body.method,
                headers,
                body: (body.body ?? undefined) as never,
                attachmentRefs: body.attachmentRefs || [],
                retries: body.retries ?? 0,
                maxRetries: body.maxRetries ?? 3,
                state: normalizeState(body.state),
                lastError: body.lastError,
            },
        });

        res.json({ success: true, data: { id: item.clientRequestId, state: item.state } });
    } catch (error) {
        logger.error('Offline queue upsert failed:', error);
        safeError(res, 500, 'Failed to queue request');
    }
});

/**
 * POST /api/v1/offline/retry
 * Retry a failed/dead-letter queued request from browser extension
 */
router.post('/retry', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.body as { id: string };
        if (!id) {
            return safeError(res, 400, 'Request ID required');
        }

        const item = await getPrisma().offlineQueueItem.findUnique({
            where: { userId_clientRequestId: { userId, clientRequestId: id } },
        });
        if (!item) {
            return safeError(res, 404, 'Request not found in queue');
        }

        await getPrisma().offlineQueueItem.update({
            where: { id: item.id },
            data: {
                state: 'pending',
                retries: 0,
                lastError: null,
                movedToDeadLetterAt: null,
                originalRetries: null,
            },
        });

        logger.info(`Offline queue retry requested for ${id}`);
        res.json({ success: true, data: { id, state: 'pending' } });
    } catch (error) {
        logger.error('Offline retry failed:', error);
        safeError(res, 500, 'Failed to retry request');
    }
});

/**
 * POST /api/v1/offline/delete
 * Delete a queued request from browser extension
 */
router.post('/delete', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { id } = req.body as { id: string };
        if (!id) {
            return safeError(res, 400, 'Request ID required');
        }

        const deleted = await getPrisma().offlineQueueItem.deleteMany({
            where: { userId, clientRequestId: id },
        });
        if (deleted.count === 0) {
            return safeError(res, 404, 'Request not found in queue');
        }

        logger.info(`Offline queue delete requested for ${id}`);
        res.json({ success: true, data: { id, deleted: true } });
    } catch (error) {
        logger.error('Offline delete failed:', error);
        safeError(res, 500, 'Failed to delete request');
    }
});

/**
 * GET /api/v1/offline/status
 * Get offline queue status for current user
 */
router.get('/status', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;

        const grouped = await getPrisma().offlineQueueItem.groupBy({
            by: ['state'],
            where: { userId },
            _count: { _all: true },
        });

        const counts = new Map(grouped.map(g => [g.state, g._count._all]));
        res.json({
            success: true,
            data: {
                pending: counts.get('pending') || 0,
                failed: counts.get('failed') || 0,
                conflict: counts.get('conflict') || 0,
                deadLetter: counts.get('dead_letter') || 0,
                total: grouped.reduce((sum, g) => sum + g._count._all, 0),
            }
        });
    } catch (error) {
        logger.error('Offline status failed:', error);
        safeError(res, 500, 'Failed to get offline status');
    }
});

export default router;
