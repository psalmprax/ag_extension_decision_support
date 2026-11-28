import { Router, Request, Response } from 'express';
import { query } from '../services/databaseService';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { sendSuccess, sendCreated, sendForbidden, sendError } from '@/utils/response';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { isUuid } from '@/utils/uuid';
import { alertsToReview, sendReviewedAlert, MESSAGE_MAX } from '@/services/alerts/alertReview';

/** What an alert needs: a kind and a title; everything else is optional. */
const createAlertBody = z.object({
    type: z.string().trim().min(1).max(50),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().max(5000).optional(),
    location: z.string().max(255).optional(),
    affectedFarmers: z.array(z.string().uuid()).max(5000).optional(),
    /** Text the farmers in affectedFarmers too (on the channel each last used). */
    notifyFarmers: z.boolean().optional(),
});

const router = Router();

interface AlertPrincipal {
    userId: string;
    role: string;
}

// Alerts are tenant-scoped: non-admins see alerts in their own tenant, plus
// (for officers/farmers) legacy alerts that affect farmers they serve. Admins
// see everything.
async function buildAlertScope(user: AlertPrincipal | undefined): Promise<{ clause: string; params: unknown[] } | null> {
    if (!user?.userId || !user.role) return null;
    if (user.role === 'admin') return { clause: '', params: [] };

    const tenantId = await getPrincipalTenantId(user.userId);
    const params: unknown[] = [];
    let clause = '';

    if (tenantId) {
        params.push(tenantId);
        clause = `(tenant_id = $1`;
    }

    if (user.role === 'extension_officer' || user.role === 'farmer') {
        const ownerColumn = user.role === 'extension_officer' ? 'assigned_officer_id' : 'user_id';
        params.push(user.userId);
        const ownerRef = `$${params.length}`;
        const farmerOverlap = `affected_farmers && ARRAY(SELECT id FROM farmers WHERE ${ownerColumn} = ${ownerRef})`;
        clause += clause ? ` OR ${farmerOverlap})` : `(${farmerOverlap})`;
    } else if (clause) {
        clause += ')';
    }

    if (!clause) return null;
    return { clause: ` AND ${clause}`, params };
}

// Apply authentication to all alert routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Get all active alerts
router.get('/', async (req: Request, res: Response) => {
    try {
        const scope = await buildAlertScope(req.user as AlertPrincipal | undefined);
        if (!scope) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }
        const result = await query(
            `SELECT id, type, severity, title, description, location, affected_farmers, triggered_at, is_active
            FROM alerts
            WHERE is_active = true${scope.clause}
            ORDER BY triggered_at DESC`,
            scope.params
        );
        sendSuccess(res, result.rows);
    } catch (error) {
        logger.error('Error fetching alerts:', error);
        sendError(res, 500, 'Failed to fetch alerts');
    }
});

// Create a new alert (Extension Officer/Admin only)
router.post('/', authorize(['extension_officer', 'admin']), validate({ body: createAlertBody }), async (req: Request, res: Response) => {
    const { type, severity, title, description, location, affectedFarmers, notifyFarmers } = req.body;

    if (req.user?.role !== 'extension_officer' && req.user?.role !== 'admin') {
        return sendForbidden(res, 'Only officers and admins can create alerts');
    }

    try {
        const farmerIds = Array.isArray(affectedFarmers) && affectedFarmers.length > 0 ? affectedFarmers : [];

        // An officer may only raise alerts for farmers assigned to them,
        // mirroring the write-access rule enforced on SMS/WhatsApp/Telegram.
        if (req.user?.role === 'extension_officer' && farmerIds.length > 0) {
            const ownership = await query<{ id: string }>(
                `SELECT id FROM farmers
                 WHERE id = ANY($1::uuid[]) AND assigned_officer_id = $2`,
                [farmerIds, req.user.userId]
            );
            if (ownership.rows.length !== farmerIds.length) {
                return sendForbidden(res, 'Alerts can only target farmers assigned to you');
            }
        }

        // Resolve tenant from the first affected farmer (or the caller's tenant).
        let tenantId: string | null = null;
        if (farmerIds.length > 0) {
            const fRes = await query('SELECT tenant_id FROM farmers WHERE id = $1 LIMIT 1', [farmerIds[0]]);
            tenantId = fRes.rows[0]?.tenant_id ?? null;
        }
        if (!tenantId) {
            const tRes = await query('SELECT tenant_id FROM users WHERE id = $1 LIMIT 1', [req.user?.userId]);
            tenantId = tRes.rows[0]?.tenant_id ?? null;
        }
        // The farmers hear it in the officer's name: "Alert from Daniel Banda: ...".
        const tellFarmers = notifyFarmers === true && farmerIds.length > 0;
        const officerName = tellFarmers
            ? (await query<{ name: string | null }>(
                `SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') AS name FROM users WHERE id = $1`,
                [req.user?.userId],
            )).rows[0]?.name ?? null
            : null;
        const result = await query(`
            INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at, notify_farmers, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), $8, $9)
            RETURNING id, title, triggered_at, notify_farmers
        `, [type, severity || 'medium', title, description, location, farmerIds, tenantId, tellFarmers, officerName ? JSON.stringify({ officerName }) : null]);
        sendCreated(res, result.rows[0]);
    } catch (error) {
        logger.error('Error creating alert:', error);
        sendError(res, 500, 'Failed to create alert');
    }
});

const sendToFarmersBody = z.object({ message: z.string().trim().min(3).max(MESSAGE_MAX) });

// Alerts waiting for an officer's look before farmers hear (crop stress, possible outbreaks)
router.get('/review', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    try {
        sendSuccess(res, await alertsToReview(req.user as AlertPrincipal));
    } catch (error) {
        logger.error('Error listing alerts to review:', error);
        sendError(res, 500, 'Failed to list alerts to review');
    }
});

// The officer's own message about a reviewed alert, to their farmers among those named
router.post('/:id/send-to-farmers', authorize(['extension_officer', 'admin']), validate({ body: sendToFarmersBody }), async (req: Request, res: Response) => {
    if (!isUuid(req.params.id)) return sendError(res, 404, 'Alert not found');
    try {
        const result = await sendReviewedAlert(req.params.id, req.user as AlertPrincipal, req.body.message);
        if (result.status === 'not_found') return sendError(res, 404, 'Alert not found');
        if (result.status === 'no_farmers') return sendForbidden(res, 'None of the farmers named are yours');
        if (result.status === 'already_sent') return sendError(res, 409, 'You have already sent a message about this alert');
        sendCreated(res, result);
    } catch (error) {
        logger.error('Error sending reviewed alert:', error);
        sendError(res, 500, 'Failed to send the message');
    }
});

// Resolve an alert
router.patch('/:id/resolve', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    const { id } = req.params;

    if (req.user?.role !== 'extension_officer' && req.user?.role !== 'admin') {
        return sendForbidden(res, 'Only officers and admins can resolve alerts');
    }

    try {
        const scope = await buildAlertScope(req.user as AlertPrincipal | undefined);
        if (!scope) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }
        const params = [id, ...scope.params];
        const result = await query(`
            UPDATE alerts
            SET is_active = false, resolved_at = NOW()
            WHERE id = $1${scope.clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)}
        `, params);
        if ((result.rowCount ?? 0) === 0) {
            return sendForbidden(res, 'Alert not found in your scope');
        }
        sendSuccess(res, { message: 'Alert marked as resolved' });
    } catch (error) {
        logger.error('Error resolving alert:', error);
        sendError(res, 500, 'Failed to resolve alert');
    }
});

export default router;
