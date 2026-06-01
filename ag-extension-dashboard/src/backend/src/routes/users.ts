/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication to all users routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

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
            const result = await query('SELECT id, first_name, last_name, email, role, region, phone, created_at FROM users WHERE id = $1', [id]);
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

const ALL_ROLES = ['admin', 'regional_manager', 'extension_officer', 'farmer'] as const;
const BASIC_ROLES = ['extension_officer', 'farmer'] as const;

// Create user (admin-only for elevated roles)
router.post('/', async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, email, password, role, region, phone } = req.body;
        const currentUser = (req as any).user;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ success: false, error: 'Email, password, firstName, and lastName are required' });
        }

        const userRole = role || 'extension_officer';

        // Security: only admins can create admin or regional_manager accounts
        if (!BASIC_ROLES.includes(userRole) && currentUser?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admins can create admin or regional manager accounts' });
        }

        if (!ALL_ROLES.includes(userRole)) {
            return res.status(400).json({ success: false, error: `Invalid role. Allowed: ${ALL_ROLES.join(', ')}` });
        }

        // Check if email already exists
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'A user with this email already exists' });
        }

        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await query(`
            INSERT INTO users (first_name, last_name, email, password_hash, role, region, phone, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id, first_name, last_name, email, role, region, phone
        `, [firstName, lastName, email, passwordHash, userRole, region, phone]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        logger.error('Create user error:', error);
        res.status(500).json({ success: false, error: 'Failed to create user' });
    }
});

// Get current user profile
router.get('/me', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const pool = getPool();

        let user = null;
        if (pool) {
            const result = await query('SELECT id, first_name, last_name, email, role, region, phone, created_at FROM users WHERE id = $1', [userId]);
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
