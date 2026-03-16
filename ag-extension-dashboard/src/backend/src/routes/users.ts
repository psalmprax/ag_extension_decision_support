/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication to all users routes
router.use(authorize('admin', 'regional_manager', 'extension_officer'));

// Get all users (extension officers)
router.get('/', async (req: Request, res: Response) => {
    try {
        const { role, region, limit = '50', offset = '0' } = req.query;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        let sql = 'SELECT id, name, email, role, region, phone, created_at FROM users WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (role) {
            sql += ' AND role = $' + paramIndex++;
            params.push(role);
        }
        if (region) {
            sql += ' AND region = $' + paramIndex++;
            params.push(region);
        }

        sql += ' ORDER BY created_at DESC LIMIT $' + paramIndex++ + ' OFFSET $' + paramIndex;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await query(sql, params);

        res.json({
            success: true,
            data: {
                users: result.rows.map((u: any) => ({
                    id: u.id,
                    firstName: u.first_name,
                    lastName: u.last_name,
                    email: u.email,
                    role: u.role,
                    region: u.region,
                    phone: u.phone,
                })),
                total: result.rows.length,
            },
        });
    } catch (error) {
        logger.error('Get users error:', error);
        res.status(500).json({ success: false, error: 'Failed to get users' });
    }
});

// Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let user = null;
        if (pool) {
            const result = await query('SELECT * FROM users WHERE id = $1', [id]);
            user = result.rows[0];
        }

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email,
                role: user.role,
                region: user.region,
                phone: user.phone,
                assignedFarmers: user.assigned_farmers || 0,
                completedVisits: user.completed_visits || 0,
                satisfactionScore: user.satisfaction_score || 0,
            },
        });
    } catch (error) {
        logger.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

// Create user
router.post('/', async (req: Request, res: Response) => {
    try {
        const { name, email, role, region, phone } = req.body;
        const pool = getPool();

        if (!pool) {
            const mockId = 'u_' + Date.now();
            return res.status(201).json({
                success: true,
                data: {
                    id: mockId,
                    name,
                    email,
                    role: role || 'extension_officer',
                    region,
                    phone,
                    createdAt: new Date().toISOString(),
                },
            });
        }

        const result = await query(`
            INSERT INTO users (name, email, role, region, phone, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, name, email, role, region, phone
        `, [name, email, role || 'extension_officer', region, phone]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Create user error:', error);
        res.status(500).json({ success: false, error: 'Failed to create user' });
    }
});

// Get current user profile
router.get('/me', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId || 'u1';
        const pool = getPool();

        let user = null;
        if (pool) {
            const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
            user = result.rows[0];
        }

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                name: `${user.first_name} ${user.last_name}`,
                email: user.email,
                role: user.role,
                region: user.region,
                phone: user.phone,
                assignedFarmers: user.assigned_farmers || 0,
                completedVisits: user.completed_visits || 0,
                satisfactionScore: user.satisfaction_score || 0,
            },
        });
    } catch (error) {
        logger.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to get profile' });
    }
});

export default router;
