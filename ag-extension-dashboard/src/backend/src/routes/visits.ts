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
import { getFarmerForPrincipal, getPrincipalTenantId } from '@/services/dataGovernanceService';
import type { PoolClient } from 'pg';

const router = Router();

type VisitPrincipal = { userId: string; role: string };

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function buildVisitScope(user: VisitPrincipal | undefined): Promise<{ clause: string; params: unknown[] }> {
    if (!user?.userId || !user.role) throw new Error('AUTHENTICATION_REQUIRED');
    if (user.role === 'admin') return { clause: '', params: [] };

    const tenantId = await getPrincipalTenantId(user.userId);
    if (!tenantId) throw new Error('TENANT_MEMBERSHIP_REQUIRED');

    const params: unknown[] = [tenantId];
    // Scope on the visit's own tenant_id (backfilled from the farmer), falling
    // back to the farmer's tenant for legacy rows created before the backfill.
    let clause = ' AND (v.tenant_id = $1 OR (v.tenant_id IS NULL AND f.tenant_id = $1))';
    if (user.role === 'extension_officer') {
        params.push(user.userId);
        clause += ' AND f.assigned_officer_id = $2';
    }
    if (user.role === 'farmer') {
        params.push(user.userId);
        clause += ' AND f.user_id = $2';
    }
    return { clause, params };
}

async function canAccessFarmer(req: Request, farmerId: string): Promise<boolean> {
    if (!req.user?.userId || !req.user.role) return false;
    if (req.user.role === 'admin') return true;
    return Boolean(await getFarmerForPrincipal(farmerId, { userId: req.user.userId, role: req.user.role }));
}

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

        let scope: { clause: string; params: unknown[] };
        try {
            scope = await buildVisitScope(user);
        } catch (error) {
            if (error instanceof Error && error.message === 'TENANT_MEMBERSHIP_REQUIRED') {
                return res.status(403).json({ success: false, error: 'Tenant membership required' });
            }
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        let sql = "SELECT v.*, f.first_name || ' ' || f.last_name as farmer_name FROM visits v LEFT JOIN farmers f ON f.id = v.farmer_id WHERE 1=1";
        const params: unknown[] = [...scope.params];
        let paramIndex = params.length + 1;
        sql += scope.clause;

        // Optional explicit filters refine the tenant and role scope.
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
        if (!visit.farmer_id || !(await canAccessFarmer(req, visit.farmer_id))) {
            return res.status(403).json({ success: false, error: 'Access denied' });
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
    attachmentIds?: string[];
    status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    locationLat?: number;
    locationLng?: number;
    durationMinutes?: number;
    startedAt?: string;
    completedAt?: string;
}

async function resolveVisitFarmerContext(farmerId: string, officerId?: string): Promise<{ tenantId: string | null; resolvedOfficerId: string }> {
    const farmerLookup = await query<{ tenant_id: string | null; assigned_officer_id: string | null }>(
        `SELECT tenant_id, assigned_officer_id FROM farmers WHERE id = $1 LIMIT 1`,
        [farmerId]
    );
    const assignedOfficerId = farmerLookup.rows[0]?.assigned_officer_id ?? null;
    if (officerId && assignedOfficerId && officerId !== assignedOfficerId) {
        throw new Error('Visit officer must be the farmer\'s assigned extension officer');
    }
    return {
        tenantId: farmerLookup.rows[0]?.tenant_id ?? null,
        resolvedOfficerId: officerId || (assignedOfficerId ?? 'unassigned'),
    };
}

async function validateAttachments(
    attachmentIds: string[],
    ownerUserId: string | undefined,
    farmerId: string,
    executor: typeof query | PoolClient
): Promise<void> {
    if (attachmentIds.length === 0) return;
    if (!ownerUserId) throw new Error('Attachment owner is required');
    const attachmentCheckSql = `SELECT id FROM upload_records
        WHERE id = ANY($1::uuid[]) AND owner_user_id = $2 AND farmer_id = $3 AND status = 'active'`;
    const attachmentCheck = executor === query
        ? await query<{ id: string }>(attachmentCheckSql, [attachmentIds, ownerUserId, farmerId])
        : await (executor as PoolClient).query(attachmentCheckSql, [attachmentIds, ownerUserId, farmerId]) as { rows: Array<{ id: string }> };
    if (attachmentCheck.rows.length !== attachmentIds.length) {
        throw new Error('One or more attachments are not owned by the current user or farmer');
    }
}

async function linkAttachments(
    visitId: string,
    attachmentIds: string[],
    executor: typeof query | PoolClient
): Promise<void> {
    if (attachmentIds.length === 0) return;
    const attachmentSql = `INSERT INTO visit_attachments (visit_id, upload_id)
        SELECT $1::uuid, unnest($2::uuid[]) ON CONFLICT DO NOTHING`;
    if (executor === query) {
        await query(attachmentSql, [visitId, attachmentIds]);
    } else {
        await (executor as PoolClient).query(attachmentSql, [visitId, attachmentIds]);
    }
}

function assertMinimumDwellTime(
    duration: number | null | undefined,
    startedAt: string | null | undefined,
    completedAt: string | null | undefined,
    source: 'provided' | 'recorded'
): void {
    const dwell = duration ?? (startedAt && completedAt ? (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000 : null);
    if (dwell === null || isNaN(dwell) || dwell < 10) {
        throw new Error(`STATIONARY_FRAUD_DETECTED: Minimum parcel dwell time of 10 minutes required to verify completed visit (${source}: ${dwell != null && !isNaN(dwell) ? Math.round(dwell) : 0} mins)`);
    }
}

interface PriorVisitLocation {
    farmer_id: string | null;
    location_lat: string | number;
    location_lng: string | number;
    completed_at: Date | string | null;
    scheduled_at: Date | string | null;
    created_at: Date | string | null;
}

function getPriorVisitMovement(prev: PriorVisitLocation, scheduledAt: string, locationLat: number, locationLng: number) {
    const prevLat = parseFloat(String(prev.location_lat));
    const prevLng = parseFloat(String(prev.location_lng));
    const prevTimestamp = prev.completed_at || prev.scheduled_at || prev.created_at;
    const prevTime = prevTimestamp ? new Date(prevTimestamp).getTime() : null;
    const currTime = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
    if (isNaN(prevLat) || isNaN(prevLng) || !prevTime) return null;

    return {
        diffMinutes: Math.abs(currTime - prevTime) / (1000 * 60),
        distKm: haversineDistanceKm(prevLat, prevLng, locationLat, locationLng),
    };
}

function appendVisitNote(notes: string | undefined, anomaly: string): string {
    return notes ? `${notes} ${anomaly}` : anomaly;
}

function appendVelocityAnomalyNote(finalNotes: string | undefined, diffMinutes: number, distKm: number, effectiveOfficerId: string) {
    // 1. Velocity anomaly (> 90 km/h)
    if (diffMinutes > 0 && diffMinutes <= 15) {
        const speedKmH = distKm / (diffMinutes / 60);
        if (speedKmH > 90) {
            logger.warn(
                `[anomaly] Impossible travel velocity detected for officer ${effectiveOfficerId}: ${Math.round(speedKmH)} km/h over ${distKm.toFixed(1)} km in ${Math.round(diffMinutes)} mins`
            );
            finalNotes = appendVisitNote(finalNotes, `[VELOCITY ANOMALY: Impossible travel ${Math.round(speedKmH)} km/h]`);
        }
    }

    return finalNotes;
}

function appendStationaryAnomalyNote(
    finalNotes: string | undefined,
    diffMinutes: number,
    distKm: number,
    effectiveOfficerId: string,
    farmerId: string,
    prevFarmerId: string | null,
    status: InsertVisitParams['status']
) {
    // 2. Stationary anomaly / Dwell-Time Fraud (AD-002 / CE-003)
    if (diffMinutes < 10) {
        logger.warn(
            `[anomaly] Stationary fraud detected for officer ${effectiveOfficerId}: consecutive visit logged in ${Math.round(diffMinutes)} mins (< 10 min dwell required)`
        );
        if (status === 'completed') {
            throw new Error(`STATIONARY_FRAUD_DETECTED: Officer logged consecutive visit within ${Math.round(diffMinutes)} mins (minimum 10 minutes dwell required)`);
        }
        finalNotes = appendVisitNote(finalNotes, `[STATIONARY ANOMALY: Insufficient interval ${Math.round(diffMinutes)} mins]`);
    } else if (prevFarmerId && prevFarmerId !== farmerId && distKm < 0.05) {
        logger.warn(
            `[anomaly] Stationary armchair visit detected for officer ${effectiveOfficerId}: distinct farmers at identical location (${Math.round(distKm * 1000)}m)`
        );
        if (status === 'completed') {
            throw new Error('STATIONARY_FRAUD_DETECTED: Consecutive visits for distinct farmers logged from identical coordinates');
        }
        finalNotes = appendVisitNote(finalNotes, `[STATIONARY ANOMALY: Identical coordinates for distinct farmers]`);
    }
    return finalNotes;
}

async function checkVisitLocationAnomalies(
    params: InsertVisitParams & { locationLat: number; locationLng: number },
    effectiveOfficerId: string,
    executor: typeof query | PoolClient
): Promise<string | undefined> {
    const { farmerId, scheduledAt, locationLat, locationLng, status = 'scheduled' } = params;
    let finalNotes = params.notes;
    try {
        const priorQuery = `SELECT farmer_id, location_lat, location_lng, completed_at, scheduled_at, created_at
                            FROM visits
                            WHERE officer_id = $1 AND location_lat IS NOT NULL AND location_lng IS NOT NULL
                            ORDER BY COALESCE(completed_at, scheduled_at, created_at) DESC
                            LIMIT 1`;
        const priorResult = executor === query
            ? await query<PriorVisitLocation>(priorQuery, [effectiveOfficerId])
            : await (executor as PoolClient).query(priorQuery, [effectiveOfficerId]) as { rows: PriorVisitLocation[] };

        if (!priorResult.rows || priorResult.rows.length === 0) return finalNotes;
        const prev = priorResult.rows[0];
        const movement = getPriorVisitMovement(prev, scheduledAt, locationLat, locationLng);
        if (!movement) return finalNotes;

        const { diffMinutes, distKm } = movement;
        finalNotes = appendVelocityAnomalyNote(finalNotes, diffMinutes, distKm, effectiveOfficerId);
        finalNotes = appendStationaryAnomalyNote(finalNotes, diffMinutes, distKm, effectiveOfficerId, farmerId, prev.farmer_id, status);
    } catch (anomalyErr) {
        if (anomalyErr instanceof Error && anomalyErr.message.startsWith('STATIONARY_FRAUD_DETECTED')) {
            throw anomalyErr;
        }
        logger.error('[anomaly] Failed to compute velocity anomaly check:', anomalyErr);
    }
    return finalNotes;
}

async function performInsertVisit(
    params: InsertVisitParams,
    executor: typeof query | PoolClient
) {
    const { farmerId, officerId, visitType, scheduledAt, notes, userId, attachmentIds = [], status = 'scheduled', locationLat, locationLng } = params;
    const farmerContext = await resolveVisitFarmerContext(farmerId, officerId);
    const farmerTenantId = farmerContext.tenantId;
    // A visit's officer defaults to the farmer's assigned officer when not supplied
    // by the caller, preserving the assigned-officer consistency invariant. For
    // farmer-created visits (no assignment), fall back to the submitting user.
    const explicitOrAssigned = farmerContext.resolvedOfficerId !== 'unassigned' ? farmerContext.resolvedOfficerId : (userId || 'u1');
    const effectiveOfficerId = officerId || explicitOrAssigned;
    await validateAttachments(attachmentIds, userId, farmerId, executor);

    // A visit logged as completed from the field records completed_at = scheduled_at
    // (the officer is reporting something that already happened).
    const completedAt = status === 'completed' ? (params.completedAt || scheduledAt) : null;
    const hasLocation = typeof locationLat === 'number' && typeof locationLng === 'number';

    // AD-002: Mandate minimum 10-minute parcel dwell time on completed visits
    if (status === 'completed') {
        assertMinimumDwellTime(params.durationMinutes, params.startedAt, params.completedAt, 'provided');
    }

    let finalNotes = notes;
    if (hasLocation && effectiveOfficerId) {
        finalNotes = await checkVisitLocationAnomalies({ ...params, locationLat, locationLng }, effectiveOfficerId, executor);
    }

    const sql = `INSERT INTO visits (farmer_id, officer_id, visit_type, status, scheduled_at, completed_at, location_lat, location_lng, notes, tenant_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                 RETURNING *`;
    const values = [
        farmerId, effectiveOfficerId, visitType, status, scheduledAt, completedAt,
        hasLocation ? locationLat : null, hasLocation ? locationLng : null,
        finalNotes, farmerTenantId,
    ];

    const result = executor === query
        ? await query<VisitInsertRow>(sql, values)
        : await (executor as PoolClient).query(sql, values) as { rows: VisitInsertRow[] };
    const created = result.rows[0];
    if (created) await linkAttachments(created.id, attachmentIds, executor);
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
    durationMinutes?: number;
}

async function performUpdateVisit(
    params: UpdateVisitParams,
    executor: typeof query | PoolClient,
    existingRecord?: { duration_minutes?: number | null; started_at?: string | null; completed_at?: string | null }
) {
    const { id, status, notes, outcomes, startedAt, completedAt, duration, durationMinutes } = params;

    // AD-002: Mandate minimum 10-minute parcel dwell time on completing visits
    if (status === 'completed') {
        const effectiveDuration = duration ?? durationMinutes ?? existingRecord?.duration_minutes;
        const effectiveStart = startedAt ?? existingRecord?.started_at;
        const effectiveCompleted = completedAt ?? existingRecord?.completed_at;
        assertMinimumDwellTime(effectiveDuration, effectiveStart, effectiveCompleted, 'recorded');
    }

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
    const finalDuration = duration ?? durationMinutes;
    if (finalDuration !== undefined) {
        updates.push(`duration_minutes = $${paramIndex++}`);
        sqlParams.push(finalDuration);
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
        // Body has been normalised by validate(createVisitSchema) to the shared contract.
        const body = req.body as {
            farmerId: string; officerId?: string; visitType: string; scheduledAt: string;
            status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
            notes?: string; attachmentIds?: string[]; locationLat?: number | null; locationLng?: number | null;
            durationMinutes?: number | null; duration?: number | null;
            startedAt?: string; completedAt?: string;
        };
        const insertParams: InsertVisitParams = {
            farmerId: body.farmerId,
            officerId: body.officerId,
            visitType: body.visitType,
            scheduledAt: body.scheduledAt,
            notes: body.notes,
            userId: req.user?.userId,
            attachmentIds: body.attachmentIds ?? [],
            status: body.status === 'no_show' ? 'cancelled' : body.status,
            locationLat: typeof body.locationLat === 'number' ? body.locationLat : undefined,
            locationLng: typeof body.locationLng === 'number' ? body.locationLng : undefined,
            durationMinutes: typeof body.durationMinutes === 'number' ? body.durationMinutes : (typeof body.duration === 'number' ? body.duration : undefined),
            startedAt: body.startedAt,
            completedAt: body.completedAt,
        };

        if (!getPool()) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }
        if (!(await canAccessFarmer(req, insertParams.farmerId))) {
            return res.status(403).json({ success: false, error: 'Access denied to farmer' });
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
        if (error instanceof Error && error.message.startsWith('STATIONARY_FRAUD_DETECTED')) {
            return res.status(422).json({ success: false, error: error.message });
        }
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
            duration: typeof body.duration === 'number' ? body.duration : undefined,
            durationMinutes: typeof body.durationMinutes === 'number' ? body.durationMinutes : undefined,
        };

        if (!getPool()) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }
        if (!req.user?.userId || !req.user.role) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const existingVisit = await query<{ farmer_id: string | null; duration_minutes?: number | null; started_at?: string | null; completed_at?: string | null }>(
            'SELECT farmer_id, duration_minutes, started_at, completed_at FROM visits WHERE id = $1', [id]
        );
        const existingFarmerId = existingVisit.rows[0]?.farmer_id;
        if (!existingFarmerId || !(await canAccessFarmer(req, existingFarmerId))) {
            return res.status(403).json({ success: false, error: 'Access denied to visit' });
        }

        const result = await executeVisitMutation(
            req,
            'update',
            updateParams as unknown as Record<string, unknown>,
            200,
            executor => performUpdateVisit(updateParams, executor, existingVisit.rows[0])
        );
        return res.status(result.status).json(result.body);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('STATIONARY_FRAUD_DETECTED')) {
            return res.status(422).json({ success: false, error: error.message });
        }
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

        const user = req.user as { userId?: string; role?: string } | undefined;
        const farmerId = user?.role === 'farmer' ? user.userId : undefined;

        // Insert location log as a visit entry, bound to the calling farmer/officer
        const result = await query<VisitIdRow>(
            `INSERT INTO visits (visit_type, status, location_lat, location_lng, notes, created_at, farmer_id, officer_id)
             VALUES ('location_capture', 'completed', $1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [latitude, longitude, `GPS accuracy: ${accuracy}m (${accuracyStatus})`, timestamp || new Date().toISOString(), farmerId, user?.userId]
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
