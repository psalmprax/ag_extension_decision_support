import { Router, Request, Response } from 'express';
import { query } from '../services/databaseService';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { sendSuccess, sendCreated, sendForbidden, sendError } from '@/utils/response';

const router = Router();

// Get all active alerts
router.get('/', async (_req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT id, type, severity, title, description, location, affected_farmers, triggered_at, is_active
            FROM alerts
            WHERE is_active = true
            ORDER BY triggered_at DESC
        `);
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
        const result = await query(`
            INSERT INTO alerts (type, severity, title, description, location, affected_farmers, is_active, triggered_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
            RETURNING id, title, triggered_at
        `, [type, severity || 'medium', title, description, location, affectedFarmers || []]);
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
        await query(`
            UPDATE alerts 
            SET is_active = false, resolved_at = NOW()
            WHERE id = $1
        `, [id]);
        sendSuccess(res, { message: 'Alert marked as resolved' });
    } catch (error) {
        logger.error('Error resolving alert:', error);
        sendError(res, 500, 'Failed to resolve alert');
    }
});

export default router;
