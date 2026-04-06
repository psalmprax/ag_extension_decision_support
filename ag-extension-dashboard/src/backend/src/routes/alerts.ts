import { Router, Request, Response } from 'express';
import { query } from '../services/databaseService';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';

const router = Router();

// Get all active alerts
/**
 * @swagger
 * /api/v1/alerts:
 *   get:
 *     summary: Get all active alerts
 *     tags: [Alerts]
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT id, type, severity, title, description, location, affected_farmers, triggered_at, is_active
            FROM alerts
            WHERE is_active = true
            ORDER BY triggered_at DESC
        `);
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        logger.error('Error fetching alerts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
    }
});

// Create a new alert (Extension Officer/Admin only)
/**
 * @swagger
 * /api/v1/alerts:
 *   post:
 *     summary: Create a new alert
 *     tags: [Alerts]
 */
router.post('/', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    const { type, severity, title, description, location, affectedFarmers } = req.body;
    
    // Check permissions (redundant with authorize but kept for safety)
    if (req.user?.role !== 'extension_officer' && req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only officers and admins can create alerts' });
    }

    try {
        const result = await query(`
            INSERT INTO alerts (type, severity, title, description, location, affected_farmers, is_active, triggered_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
            RETURNING id, title, triggered_at
        `, [type, severity || 'medium', title, description, location, affectedFarmers || []]);
        
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Error creating alert:', error);
        res.status(500).json({ success: false, error: 'Failed to create alert' });
    }
});

// Resolve an alert
/**
 * @swagger
 * /api/v1/alerts/{id}/resolve:
 *   patch:
 *     summary: Resolve an alert
 *     tags: [Alerts]
 */
router.patch('/:id/resolve', authorize(['extension_officer', 'admin']), async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (req.user?.role !== 'extension_officer' && req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only officers and admins can resolve alerts' });
    }

    try {
        await query(`
            UPDATE alerts 
            SET is_active = false, resolved_at = NOW()
            WHERE id = $1
        `, [id]);
        
        res.json({ success: true, message: 'Alert marked as resolved' });
    } catch (error) {
        logger.error('Error resolving alert:', error);
        res.status(500).json({ success: false, error: 'Failed to resolve alert' });
    }
});

export default router;
