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

function extractCreateUserData(body: Record<string, unknown>) {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rawFirst = body.firstName ?? body.first_name;
    const firstName = typeof rawFirst === 'string' ? rawFirst.trim() : '';
    const rawLast = body.lastName ?? body.last_name;
    const lastName = typeof rawLast === 'string' ? rawLast.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : 'extension_officer';
    const region = typeof body.region === 'string' && body.region.trim() ? body.region.trim() : null;
    const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : 'Kenya';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;

    const allowedRoles = ['farmer', 'extension_officer', 'regional_manager', 'admin'];
    const safeRole = role.toLowerCase();
    const normalizedRole = allowedRoles.includes(safeRole) ? safeRole : 'extension_officer';

    return { email, password, firstName, lastName, normalizedRole, region, country, phone };
}

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
            `SELECT id, email, first_name, last_name, role, region, country, phone, is_active,
                    preferred_language, avatar_url, last_login, created_at
             FROM users
             ORDER BY created_at DESC`
        );
        return res.json({ success: true, data: mapUserPublicRows(rows || []) });
    } catch (error) {
        logger.error('Failed to fetch users:', error);
        return safeError(res, 500, 'Failed to fetch users');
    }
});

/**
 * GET /api/users/:id — fetch a single user (admin-only).
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'User id is required' });
        }

        const { rows } = await query<UserPublicRow>(
            `SELECT id, email, first_name, last_name, role, region, country, phone, is_active,
                    preferred_language, avatar_url, last_login, created_at
             FROM users WHERE id = $1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = rows[0];
        return res.json({ success: true, data: user ? mapUserPublicRow(user) : null });
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
        const data = extractCreateUserData((req.body || {}) as Record<string, unknown>);

        if (!data.email || !data.password || !data.firstName || !data.lastName) {
            return res.status(400).json({
                success: false,
                error: 'email, password, first name and last name are required',
            });
        }

        const password_hash = await bcrypt.hash(data.password, 10);

        const { rows } = await query<UserPublicRow>(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, region, country, phone, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, first_name, last_name, role, region, country, phone, is_active,
                       preferred_language, avatar_url, last_login`,
            [data.email, password_hash, data.firstName, data.lastName, data.normalizedRole, data.region, data.country, data.phone]
        );

        if (!rows || rows.length === 0) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

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

        const updates = (req.body || {}) as Record<string, unknown>;

        const fieldMap: Record<string, string> = {
            first_name: 'first_name',
            firstName: 'first_name',
            last_name: 'last_name',
            lastName: 'last_name',
            region: 'region',
            country: 'country',
            phone: 'phone',
            is_active: 'is_active',
            isActive: 'is_active',
            preferred_language: 'preferred_language',
            preferredLanguage: 'preferred_language',
        };

        const safeUpdates: Record<string, unknown> = {};
        for (const [key, col] of Object.entries(fieldMap)) {
            if (updates[key] !== undefined && safeUpdates[col] === undefined) {
                safeUpdates[col] = updates[key];
            }
        }
        if (Object.keys(safeUpdates).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid updates supplied' });
        }

        safeUpdates.updated_at = new Date();

        const { rows } = await query<UserPublicRow>(
            `UPDATE users SET ${Object.keys(safeUpdates).map((k, i) => `${k} = $${i + 1}`).join(', ')}
              WHERE id = $${Object.keys(safeUpdates).length + 1}
          RETURNING id, email, first_name, last_name, role, region, country, phone, is_active,
                    preferred_language, avatar_url, last_login`,
            Object.values(safeUpdates).concat(id)
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
