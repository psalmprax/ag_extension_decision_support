import { Router, Response } from 'express';
import { query } from '@/services/databaseService';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/v1/audit-logs?actorId=&action=&resourceType=&resourceId=&from=&to=&limit=&offset=
 * Admin-only read access to the audit trail.
 */
router.get('/', authorize(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const q = req.query as Record<string, string | undefined>;
        const limit = Math.min(Math.max(parseInt(q.limit || '50', 10) || 50, 1), 200);
        const offset = Math.max(parseInt(q.offset || '0', 10) || 0, 0);

        const where: string[] = [];
        const params: unknown[] = [];
        const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
        if (q.actorId) add('a.actor_id = ?', q.actorId);
        if (q.action) add('a.action ILIKE ?', `%${q.action}%`);
        if (q.resourceType) add('a.resource_type = ?', q.resourceType);
        if (q.resourceId) add('a.resource_id = ?', q.resourceId);
        if (q.from) add('a.created_at >= ?', new Date(q.from));
        if (q.to) add('a.created_at <= ?', new Date(q.to));
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        params.push(limit, offset);
        const rows = await query(
            `SELECT a.id, a.actor_id, a.actor_role, u.email AS actor_email, a.action, a.method, a.path,
                    a.resource_type, a.resource_id, a.status_code, a.ip_address, a.user_agent, a.request_body, a.created_at
               FROM audit_logs a
               LEFT JOIN users u ON u.id = a.actor_id
               ${whereSql}
              ORDER BY a.created_at DESC
              LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const count = await query(`SELECT COUNT(*)::int AS total FROM audit_logs a ${whereSql}`, params.slice(0, -2));

        res.json({ success: true, data: { items: rows.rows, total: count.rows[0]?.total ?? 0, limit, offset } });
    } catch (error) {
        logger.error('audit-logs query failed:', error);
        safeError(res, 500, 'Failed to load audit logs');
    }
});

export default router;
