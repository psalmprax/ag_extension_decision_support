import { Router, Request, Response } from 'express';
import { query } from '../services/databaseService';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { sendSuccess, sendCreated, sendForbidden, sendError } from '@/utils/response';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

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
router.post('/', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    const { type, severity, title, description, location, affectedFarmers } = req.body;

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
        const result = await query(`
            INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
            RETURNING id, title, triggered_at
        `, [type, severity || 'medium', title, description, location, farmerIds, tenantId]);
        sendCreated(res, result.rows[0]);
    } catch (error) {
        logger.error('Error creating alert:', error);
        sendError(res, 500, 'Failed to create alert');
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
