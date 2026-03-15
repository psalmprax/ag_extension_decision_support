import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { createVisitSchema } from '@/utils/schemas';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication to all visits routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

// Get all visits
router.get('/', async (req: Request, res: Response) => {
    try {
        const { officerId, farmerId, status, limit = '50', offset = '0' } = req.query;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        let sql = 'SELECT v.*, f.first_name || \' \' || f.last_name as farmer_name FROM visits v LEFT JOIN farmers f ON f.id = v.farmer_id WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (officerId) {
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

        const result = await query(sql, params);

        res.json({
            success: true,
            data: {
                visits: result.rows,
                total: result.rows.length,
            },
        });
    } catch (error) {
        logger.error('Get visits error:', error);
        res.status(500).json({ success: false, error: 'Failed to get visits' });
    }
});

// Get visit by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let visit = null;
        if (pool) {
            const result = await query(`
                SELECT v.*, f.first_name || ' ' || f.last_name as farmer_name
                FROM visits v
                LEFT JOIN farmers f ON f.id = v.farmer_id
                WHERE v.id = $1
            `, [id]);
            visit = result.rows[0];
        }

        if (!visit) {
            return res.status(404).json({ success: false, error: 'Visit not found' });
        }

        res.json({ success: true, data: visit });
    } catch (error) {
        logger.error('Get visit error:', error);
        res.status(500).json({ success: false, error: 'Failed to get visit' });
    }
});

// Create visit
router.post('/', validate(createVisitSchema), async (req: Request, res: Response) => {
    try {
        const { farmerId, officerId, type, scheduledAt, notes } = req.body;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        const result = await query(`
            INSERT INTO visits (farmer_id, officer_id, visit_type, status, scheduled_at, notes, created_at)
            VALUES ($1, $2, $3, 'scheduled', $4, $5, NOW())
            RETURNING *
        `, [farmerId, officerId || 'u1', type || 'routine', scheduledAt, notes]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Create visit error:', error);
        res.status(500).json({ success: false, error: 'Failed to create visit' });
    }
});

// Update visit
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes, outcomes, startedAt, completedAt, duration } = req.body;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (status) {
            updates.push('status = $' + paramIndex++);
            params.push(status);
        }
        if (notes) {
            updates.push('notes = $' + paramIndex++);
            params.push(notes);
        }
        if (outcomes) {
            updates.push('outcomes = $' + paramIndex++);
            params.push(outcomes);
        }
        if (startedAt) {
            updates.push('started_at = $' + paramIndex++);
            params.push(startedAt);
        }
        if (completedAt) {
            updates.push('completed_at = $' + paramIndex++);
            params.push(completedAt);
        }
        if (duration) {
            updates.push('duration_minutes = $' + paramIndex++);
            params.push(duration);
        }

        updates.push('updated_at = NOW()');
        params.push(id);

        await query('UPDATE visits SET ' + updates.join(', ') + ' WHERE id = $' + paramIndex, params);

        res.json({
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
        });
    } catch (error) {
        logger.error('Update visit error:', error);
        res.status(500).json({ success: false, error: 'Failed to update visit' });
    }
});

export default router;
