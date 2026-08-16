import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import type {
  VisitWithFarmerRow,
  VisitInsertRow,
  VisitIdRow,
} from '@/types/rowTypes';
import {
  mapVisitWithFarmerRows,
  mapVisitWithFarmerRow,
  mapVisitInsertRow,
  mapVisitIdRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { createVisitSchema, updateVisitSchema } from '@/utils/schemas';
import { authorize } from '@/middleware/authorize';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import { safeError } from '@/utils/safeResponse';
import { executeIdempotentMutation } from '@/services/idempotencyService';
import type { PoolClient } from 'pg';

const router = Router();

// Apply authentication to all visits routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Get all visits — auto-filtered by role
router.get('/', async (req: Request, res: Response) => {
    try {
        const { officerId, farmerId, status, limit = '50', offset = '0' } = req.query;
        const user = req.user;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        let sql = "SELECT v.*, f.first_name || ' ' || f.last_name as farmer_name FROM visits v LEFT JOIN farmers f ON f.id = v.farmer_id WHERE 1=1";
        const params: unknown[] = [];
        let paramIndex = 1;

        // Role-based filtering
        if (user?.role === 'extension_officer') {
            const officerIdVal = user.userId;
            if (!officerIdVal) {
                return res.status(401).json({ success: false, error: 'Missing user id' });
            }
            sql += ` AND v.farmer_id IN (SELECT id FROM farmers WHERE assigned_officer_id = $${paramIndex++})`;
            params.push(officerIdVal);
        } else if (user?.role === 'farmer') {
            const userIdVal = user.userId;
            if (!userIdVal) {
                return res.status(401).json({ success: false, error: 'Missing user id' });
            }
            sql += ` AND v.farmer_id IN (SELECT id FROM farmers WHERE user_id = $${paramIndex++})`;
            params.push(userIdVal);
        }
        // admin and regional_manager see all visits (no additional filter)

        // Optional explicit filters (override or refine role-based filtering for admins)
        if (officerId && (user?.role === 'admin' || user?.role === 'regional_manager')) {
            sql += ' AND v.officer_id = $' + paramIndex++;
            params.push(officerId);
        }
        if (farmerId) {
            sql += ' AND v.farmer_id = $' + paramIndex++;
            params.push(farmerId);
        }
        if (status) {
            sql += ' AND v.status = $' + paramIndex++;
            params.push(status);
        }

        sql += ' ORDER BY v.scheduled_at DESC LIMIT $' + paramIndex++ + ' OFFSET $' + paramIndex;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await query<VisitWithFarmerRow>(sql, params);

        res.json({
            success: true,
            data: {
                visits: mapVisitWithFarmerRows(result.rows),
                total: result.rowCount ?? result.rows.length,
            },
        });
    } catch (error) {
        logger.error('Get visits error:', error);
        safeError(res, 500, 'Failed to get visits');
    }
});

// Get visit by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let visit: VisitWithFarmerRow | null = null;
        if (pool) {
            const result = await query<VisitWithFarmerRow>(
                `SELECT v.*, f.first_name || ' ' || f.last_name as farmer_name
                 FROM visits v
                 LEFT JOIN farmers f ON f.id = v.farmer_id
                 WHERE v.id = $1`,
                [id]
            );
            visit = result.rows[0] ?? null;
        }

        if (!visit) {
            return res.status(404).json({ success: false, error: 'Visit not found' });
        }

        res.json({ success: true, data: mapVisitWithFarmerRow(visit) });
    } catch (error) {
        logger.error('Get visit error:', error);
        safeError(res, 500, 'Failed to get visit');
    }
});

interface InsertVisitParams {
    farmerId: string;
    officerId?: string;
    visitType: string;
    scheduledAt: string;
    notes?: string;
    userId?: string;
}

async function performInsertVisit(
    params: InsertVisitParams,
    executor: typeof query | PoolClient
) {
    const { farmerId, officerId, visitType, scheduledAt, notes, userId } = params;
    const values = [farmerId, officerId || userId || 'u1', visitType, scheduledAt, notes];
    const sql = `INSERT INTO visits (farmer_id, officer_id, visit_type, status, scheduled_at, notes, created_at)
                 VALUES ($1, $2, $3, 'scheduled', $4, $5, NOW())
                 RETURNING *`;

    const result = executor === query
        ? await query<VisitInsertRow>(sql, values)
        : await (executor as PoolClient).query<VisitInsertRow>(sql, values);
    const created = result.rows[0];
    return { success: true, data: created ? mapVisitInsertRow(created) : null };
}

interface UpdateVisitParams {
    id: string;
    status?: string;
    notes?: string;
    outcomes?: string;
    startedAt?: string;
    completedAt?: string;
    duration?: number;
}

async function performUpdateVisit(
    params: UpdateVisitParams,
    executor: typeof query | PoolClient
) {
    const { id, status, notes, outcomes, startedAt, completedAt, duration } = params;
    const updates: string[] = [];
    const sqlParams: unknown[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        sqlParams.push(status);
    }
    if (notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        sqlParams.push(notes);
    }
    if (outcomes !== undefined) {
        updates.push(`outcomes = $${paramIndex++}`);
        sqlParams.push(outcomes);
    }
    if (startedAt !== undefined) {
        updates.push(`started_at = $${paramIndex++}`);
        sqlParams.push(startedAt);
    }
    if (completedAt !== undefined) {
        updates.push(`completed_at = $${paramIndex++}`);
        sqlParams.push(completedAt);
    }
    if (duration !== undefined) {
        updates.push(`duration_minutes = $${paramIndex++}`);
        sqlParams.push(duration);
    }

    updates.push('updated_at = NOW()');
    sqlParams.push(id);
    const sql = `UPDATE visits SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    if (executor === query) {
        await query<Record<string, unknown>>(sql, sqlParams);
    } else {
        await (executor as PoolClient).query(sql, sqlParams);
    }

    return {
        success: true,
        data: {
            id,
            status,
            notes,
            outcomes,
            startedAt,
            completedAt,
            duration,
            updatedAt: new Date().toISOString(),
        },
    };
}

interface MutationExecution {
    status: number;
    body: Record<string, unknown>;
}

function getMutationContext(req: Request): { mutationKey: string; userId: string } | MutationExecution | null {
    const mutationKey = req.get('Idempotency-Key');
    if (!mutationKey) return null;
    if (!req.user?.userId) {
        return {
            status: 401,
            body: { success: false, error: 'Authentication required for idempotent writes' },
        };
    }
    if (mutationKey.length > 128) {
        return {
            status: 400,
            body: { success: false, error: 'Idempotency-Key must be 128 characters or fewer' },
        };
    }
    return { mutationKey, userId: req.user.userId };
}

async function executeVisitMutation(
    req: Request,
    operation: 'create' | 'update',
    payload: Record<string, unknown>,
    defaultStatus: number,
    mutation: (executor: typeof query | PoolClient) => Promise<Record<string, unknown>>
): Promise<MutationExecution> {
    const context = getMutationContext(req);
    if (!context) {
        return { status: defaultStatus, body: await mutation(query) };
    }
    if ('body' in context) return context;

    return executeIdempotentMutation(
        {
            userId: context.userId,
            mutationKey: context.mutationKey,
            operation,
            entityType: 'visit',
            payload,
        },
        async client => ({
            status: defaultStatus,
            body: await mutation(client),
        })
    );
}

// Create visit
router.post('/', validate(createVisitSchema), async (req: Request, res: Response) => {
    try {
        const body = req.body as Record<string, unknown>;
        const insertParams: InsertVisitParams = {
            farmerId: (body.farmerId ?? body.farmer_id) as string,
            officerId: body.officerId as string | undefined,
            visitType: (body.visitType ?? body.visit_type ?? body.type ?? 'routine') as string,
            scheduledAt: (body.scheduledAt ?? body.scheduled_at) as string,
            notes: body.notes as string | undefined,
            userId: req.user?.userId,
        };

        if (!getPool()) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        const result = await executeVisitMutation(
            req,
            'create',
            insertParams as unknown as Record<string, unknown>,
            201,
            executor => performInsertVisit(insertParams, executor)
        );
        return res.status(result.status).json(result.body);
    } catch (error) {
        logger.error('Create visit error:', error);
        safeError(res, 500, 'Failed to create visit');
    }
});

// Update visit
router.patch('/:id', validate(updateVisitSchema), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = req.body as Record<string, unknown>;
        const updateParams: UpdateVisitParams = {
            id,
            status: body.status as string | undefined,
            notes: body.notes as string | undefined,
            outcomes: body.outcomes as string | undefined,
            startedAt: body.startedAt as string | undefined,
            completedAt: body.completedAt as string | undefined,
            duration: body.duration as number | undefined,
        };

        if (!getPool()) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        const result = await executeVisitMutation(
            req,
            'update',
            updateParams as unknown as Record<string, unknown>,
            200,
            executor => performUpdateVisit(updateParams, executor)
        );
        return res.status(result.status).json(result.body);
    } catch (error) {
        logger.error('Update visit error:', error);
        safeError(res, 500, 'Failed to update visit');
    }
});

// Log GPS location for extension use
router.post('/location', async (req: Request, res: Response) => {
    try {
        const { latitude, longitude, accuracy, accuracyStatus, timestamp } = req.body;

        // Validate coordinates
        if (!latitude || !longitude || typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({ success: false, error: 'Invalid coordinates' });
        }

        // Insert location log as a visit entry
        const result = await query<VisitIdRow>(
            `INSERT INTO visits (visit_type, status, location_lat, location_lng, notes, created_at)
             VALUES ('location_capture', 'completed', $1, $2, $3, $4)
             RETURNING id`,
            [latitude, longitude, `GPS accuracy: ${accuracy}m (${accuracyStatus})`, timestamp || new Date().toISOString()]
        );

        const id = result.rows[0] ? mapVisitIdRow(result.rows[0]) : null;
        res.json({
            success: true,
            data: {
                visitId: id?.id,
                message: `Location logged: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
            }
        });
    } catch (error) {
        logger.error('Log location error:', error);
        safeError(res, 500, 'Failed to log location');
    }
});

import { createShareRoute } from './shareRouteFactory';
router.use(createShareRoute('visit'));

/**
 * @openapi
 * /api/visits/bulk/delete:
 *   post:
 *     summary: Bulk delete visits
 *     tags: [Visits]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Bulk delete result
 */
router.post('/bulk/delete', async (req: Request, res: Response) => {
    try {
        const { ids, reason } = req.body;
        const user = req.user;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IDs array is required and cannot be empty'
            });
        }

        if (!user?.userId || !user.role) {
            return res.status(401).json({ success: false, error: 'Authentication required for bulk operations' });
        }

        // Only admins and regional managers can perform bulk operations
        if (!['admin', 'regional_manager'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for bulk operations'
            });
        }

        const result = await bulkOperationsService.bulkDeleteVisits(
            { ids: ids as string[], reason },
            user.userId,
            user.role
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Bulk delete visits error:', error);
        safeError(res, 500, 'Failed to perform bulk delete operation');
    }
});

export default router;
