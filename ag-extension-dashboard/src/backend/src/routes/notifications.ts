import { Router, Request, Response } from 'express';
import { AuthRequest } from '../middleware/authorize';
import { query, getPool } from '../services/databaseService';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { subscribeUser, unsubscribeUser, sendPushNotification } from '../services/pushNotificationService';
import { safeError } from '@/utils/safeResponse';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

const router = Router();

// Get VAPID public key (public endpoint)
router.get('/vapid-public-key', (req: Request, res: Response) => {
    res.json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY || ''
    });
});

// Apply authentication to all routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Notifications are per-user; the tenant predicate is defense-in-depth so a
// user only sees rows stamped with their own tenant (or legacy unstamped rows
// that belong to them via user_id).
async function buildNotificationTenantPredicate(userId: string): Promise<{ clause: string; params: unknown[] }> {
    const tenantId = await getPrincipalTenantId(userId);
    if (!tenantId) return { clause: '', params: [] };
    return { clause: ' AND (tenant_id = $2 OR tenant_id IS NULL)', params: [tenantId] };
}

// Get all notifications for current user
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const tenant = await buildNotificationTenantPredicate(userId as string);
        const result = await query(`
            SELECT id, type, title, message, metadata, is_read, channel, created_at, read_at
            FROM notifications
            WHERE user_id = $1${tenant.clause}
            ORDER BY created_at DESC
            LIMIT 50
        `, [userId, ...tenant.params]);

        res.json({
            success: true,
            data: result.rows.map((n: Record<string, unknown>) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                metadata: n.metadata,
                isRead: n.is_read,
                channel: n.channel,
                createdAt: n.created_at,
                readAt: n.read_at
            }))
        });
    } catch (error) {
        logger.error('Get notifications error:', error);
        safeError(res, 500, 'Failed to fetch notifications');
    }
});

// Get unread notification count
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const tenant = await buildNotificationTenantPredicate(userId as string);
        const result = await query(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = $1 AND is_read = FALSE${tenant.clause}
        `, [userId, ...tenant.params]);

        res.json({
            success: true,
            data: { count: parseInt(result.rows[0].count) }
        });
    } catch (error) {
        logger.error('Get unread count error:', error);
        safeError(res, 500, 'Failed to fetch count');
    }
});

// Mark notification as read
router.put('/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        await query(`
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Mark read error:', error);
        safeError(res, 500, 'Failed to mark as read');
    }
});

// Mark all notifications as read
router.put('/read-all', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        await query(`
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE user_id = $1 AND is_read = FALSE
        `, [userId]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Mark all read error:', error);
        safeError(res, 500, 'Failed to mark all as read');
    }
});

// Delete notification
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, userId]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Delete notification error:', error);
        safeError(res, 500, 'Failed to delete notification');
    }
});

// Clear all notifications
router.delete('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        await query('DELETE FROM notifications WHERE user_id = $1', [userId]);

        res.json({ success: true });
    } catch (error) {
        logger.error('Clear notifications error:', error);
        safeError(res, 500, 'Failed to clear notifications');
    }
});

// Admin/Manager: Send notification to user
const notificationBody = {
    type: z.string().trim().min(1).max(50).optional(),
    title: z.string().trim().min(1).max(255),
    message: z.string().trim().min(1).max(5000),
    metadata: z.record(z.string(), z.unknown()).optional(),
};
const sendBody = z.object({ userId: z.string().uuid(), ...notificationBody });
const broadcastBody = z.object({ role: z.enum(['admin', 'regional_manager', 'extension_officer', 'farmer']).optional(), ...notificationBody });

/**
 * Who a sender may notify, as SQL on users `u`: an administrator anyone; a regional
 * manager the people in their own organisation and region.
 */
async function recipientScope(sender: { userId: string; role: string }, firstParam: number): Promise<{ sql: string; params: unknown[] }> {
    if (sender.role === 'admin') return { sql: 'TRUE', params: [] };
    const { rows } = await query<{ tenant_id: string | null; region: string | null }>(
        'SELECT tenant_id, region FROM users WHERE id = $1', [sender.userId]);
    const me = rows[0];
    return {
        sql: `u.tenant_id = $${firstParam} AND u.region = $${firstParam + 1}`,
        params: [me?.tenant_id ?? null, me?.region ?? null],
    };
}

// Admin/Manager: Send notification to one person they may reach
router.post('/send', authorize(['admin', 'regional_manager']), validate({ body: sendBody }), async (req: AuthRequest, res: Response) => {
    try {
        const { userId, type, title, message, metadata } = req.body as z.infer<typeof sendBody>;
        const scope = await recipientScope(req.user!, 2);
        const target = (await query<{ tenant_id: string | null; farmer_id: string | null }>(
            `SELECT u.tenant_id, f.id AS farmer_id
               FROM users u
               LEFT JOIN farmers f ON f.user_id = u.id
              WHERE u.id = $1 AND ${scope.sql} LIMIT 1`,
            [userId, ...scope.params]
        )).rows[0];
        if (!target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const result = await query(`
            INSERT INTO notifications (user_id, type, title, message, metadata, channel, tenant_id, farmer_id)
            VALUES ($1, $2, $3, $4, $5, 'in_app', $6, $7)
            RETURNING id
        `, [userId, type || 'info', title, message, JSON.stringify(metadata || {}), target.tenant_id, target.farmer_id]);

        res.status(201).json({ success: true, data: { id: result.rows[0].id } });
    } catch (error) {
        logger.error('Send notification error:', error);
        safeError(res, 500, 'Failed to send notification');
    }
});

// Admin/Manager: Notify everyone they may reach, optionally one role only
router.post('/broadcast', authorize(['admin', 'regional_manager']), validate({ body: broadcastBody }), async (req: AuthRequest, res: Response) => {
    try {
        const { type, title, message, metadata, role } = req.body as z.infer<typeof broadcastBody>;
        const scope = await recipientScope(req.user!, 6);
        const roleClause = role ? ` AND u.role = $${6 + scope.params.length}` : '';
        const result = await query(`
            INSERT INTO notifications (user_id, type, title, message, metadata, channel, tenant_id)
            SELECT u.id, $1, $2, $3, $4, $5, u.tenant_id
              FROM users u
             WHERE u.is_active = true AND ${scope.sql}${roleClause}
        `, [type || 'info', title, message, JSON.stringify(metadata || {}), 'in_app', ...scope.params, ...(role ? [role] : [])]);

        res.json({ success: true, data: { sent: result.rowCount ?? 0 } });
    } catch (error) {
        logger.error('Broadcast notification error:', error);
        safeError(res, 500, 'Failed to broadcast notification');
    }
});

// Subscribe to push notifications
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }
        const subscription = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, error: 'Invalid subscription' });
        }

        await subscribeUser(userId, subscription);
        res.status(201).json({ success: true });
    } catch (error) {
        logger.error('Subscribe error:', error);
        safeError(res, 500, 'Failed to subscribe');
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req: AuthRequest, res: Response) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ success: false, error: 'Endpoint required' });
        }
        await unsubscribeUser(endpoint);
        res.json({ success: true });
    } catch (error) {
        logger.error('Unsubscribe error:', error);
        safeError(res, 500, 'Failed to unsubscribe');
    }
});

// Test push notification
router.post('/test-push', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'User not authenticated' });
        }
        await sendPushNotification(userId, 'Test Notification', 'Web push is working!', '/');
        res.json({ success: true });
    } catch (error) {
        logger.error('Test push error:', error);
        safeError(res, 500, 'Failed to send test push');
    }
});

export default router;
