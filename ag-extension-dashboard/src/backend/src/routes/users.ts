import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, getPool } from '@/services/databaseService';
import type { CountRow, UserRow, UserPublicRow } from '@/types/rowTypes';
import { mapUserPublicRows, mapUserPublicRow, mapUserRows } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

router.use(authorize(['admin', 'regional_manager']));

/**
 * GET /api/users — list users (admin-only).
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const { rows } = await query<UserPublicRow>(
            `SELECT id, email, first_name, last_name, role, region, phone, is_active,
                    preferred_language, avatar_url, last_login
               FROM users
              ORDER BY created_at DESC`
        );

        return res.json({ success: true, data: mapUserPublicRows(rows) });
    } catch (error) {
        logger.error('Failed to list users:', error);
        return safeError(res, 500, 'Failed to list users');
    }
});

/**
 * GET /api/users/:id — fetch a single user.
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const { rows } = await query<UserPublicRow>(
            `SELECT id, email, first_name, last_name, role, region, phone, is_active,
                    preferred_language, avatar_url, last_login
               FROM users WHERE id = $1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const found = rows[0];
        return res.json({ success: true, data: found ? mapUserPublicRow(found) : null });
    } catch (error) {
        logger.error('Failed to fetch user:', error);
        return safeError(res, 500, 'Failed to fetch user');
    }
});

/**
 * POST /api/users — create a user.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { email, first_name, last_name, role, region, phone, password } = req.body as {
            email?: string;
            first_name?: string;
            last_name?: string;
            role?: string;
            region?: string;
            phone?: string;
            password?: string;
        };

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'email and password are required' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const { rows } = await query<UserPublicRow>(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             RETURNING id, email, first_name, last_name, role, region, phone, is_active,
                       preferred_language, avatar_url, last_login`,
            [email, password_hash, first_name ?? null, last_name ?? null, role ?? 'farmer', region ?? null, phone ?? null]
        );

        const created = rows[0];
        return res.status(201).json({ success: true, data: created ? mapUserPublicRow(created) : null });
    } catch (error) {
        logger.error('Failed to create user:', error);
        return safeError(res, 500, 'Failed to create user');
    }
});

/**
 * PUT /api/users/:id — update a user.
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const updates = req.body as Partial<{
            first_name: string;
            last_name: string;
            role: string;
            region: string;
            phone: string;
            is_active: boolean;
            preferred_language: string;
        }>;

        const fields: string[] = [];
        const params: unknown[] = [];
        let i = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) continue;
            fields.push(`${key} = $${i++}`);
            params.push(value);
        }
        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No updates supplied' });
        }
        params.push(id);

        const { rows } = await query<UserPublicRow>(
            `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
              WHERE id = $${i}
         RETURNING id, email, first_name, last_name, role, region, phone, is_active,
                   preferred_language, avatar_url, last_login`,
            params
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const updated = rows[0];
        return res.json({ success: true, data: updated ? mapUserPublicRow(updated) : null });
    } catch (error) {
        logger.error('Failed to update user:', error);
        return safeError(res, 500, 'Failed to update user');
    }
});

/**
 * DELETE /api/users/:id — soft-delete a user.
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const { rows } = await query<CountRow>(
            'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to deactivate user:', error);
        return safeError(res, 500, 'Failed to deactivate user');
    }
});

/**
 * GET /api/users/role/:role — list users by role (used by officer routing).
 */
router.get('/role/:role', async (req: Request, res: Response) => {
    try {
        const role = req.params.role;
        if (!role) {
            return res.status(400).json({ success: false, error: 'role is required' });
        }

        const { rows } = await query<UserRow>(
            'SELECT * FROM users WHERE role = $1 AND is_active = true ORDER BY first_name',
            [role]
        );

        return res.json({ success: true, data: mapUserRows(rows) });
    } catch (error) {
        logger.error('Failed to list users by role:', error);
        return safeError(res, 500, 'Failed to list users by role');
    }
});

export default router;
