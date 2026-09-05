import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import type { ApiClientRow, CountRow, AuthenticatedRequestUser } from '@/types/rowTypes';
import { mapApiClientRows, mapApiClientRow } from '@/types/dtos';
import { authorize } from '@/middleware/authorize';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/**
 * GET /api/context-menus/clients — list API clients (admin only).
 */
router.get('/clients', authorize(['admin']), async (_req: Request, res: Response) => {
    try {
        const { rows } = await query<ApiClientRow>(
            'SELECT * FROM api_clients ORDER BY created_at DESC'
        );
        return res.json({ success: true, data: mapApiClientRows(rows) });
    } catch (error) {
        logger.error('Failed to list API clients:', error);
        return safeError(res, 500, 'Failed to list API clients');
    }
});

/**
 * POST /api/context-menus/clients — register an API client.
 * Schema: id, owner_user_id, name, status, monthly_quota, current_period_start/end, created/updated_at.
 */
router.post('/clients', authorize(['admin']), async (req: AuthedRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const body = req.body as { name?: string; monthly_quota?: number };

        if (!body.name) {
            return res.status(400).json({ success: false, error: 'name is required' });
        }

        const { rows } = await query<ApiClientRow>(
            `INSERT INTO api_clients (owner_user_id, name, status, monthly_quota, current_period_start, current_period_end)
             VALUES ($1, $2, 'active', $3, NOW(), NOW() + INTERVAL '30 days')
             RETURNING *`,
            [userId, body.name, body.monthly_quota ?? 1000]
        );

        const created = rows[0];
        return res.status(201).json({ success: true, data: created ? mapApiClientRow(created) : null });
    } catch (error) {
        logger.error('Failed to create API client:', error);
        return safeError(res, 500, 'Failed to create API client');
    }
});

/**
 * PATCH /api/context-menus/clients/:id — update quota / status.
 */
router.patch('/clients/:id', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Client id is required' });
        }
        const updates = req.body as Partial<{ name: string; status: string; monthly_quota: number }>;

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
        fields.push('updated_at = NOW()');
        params.push(id);

        const { rows } = await query<ApiClientRow>(
            `UPDATE api_clients SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
            params
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }
        const updated = rows[0];
        return res.json({ success: true, data: updated ? mapApiClientRow(updated) : null });
    } catch (error) {
        logger.error('Failed to update API client:', error);
        return safeError(res, 500, 'Failed to update API client');
    }
});

/**
 * DELETE /api/context-menus/clients/:id — set status='disabled' (soft-delete).
 */
router.delete('/clients/:id', authorize(['admin']), async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Client id is required' });
        }
        const { rows } = await query<CountRow>(
            'UPDATE api_clients SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
            ['disabled', id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Client not found' });
        }
        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to disable API client:', error);
        return safeError(res, 500, 'Failed to disable API client');
    }
});

/**
 * GET /api/context-menus/templates — list context-menu templates for the caller.
 */
router.get('/templates', authorize(['admin', 'regional_manager', 'extension_officer']), async (_req: Request, res: Response) => {
    try {
        return res.json({
            success: false,
            errorCode: 'CONTEXT_MENU_TEMPLATES_NOT_CONFIGURED',
            error: 'Context-menu templates are not configured.',
        });
    } catch (error) {
        logger.error('Failed to list context-menu templates:', error);
        return safeError(res, 500, 'Failed to list context-menu templates');
    }
});

/**
 * GET /api/context-menus/bulk/:entityType — bulk context menu options.
 */
router.get('/bulk/:entityType', async (req: Request, res: Response) => {
    const { entityType } = req.params;
    return res.json({
        success: true,
        data: {
            entityType,
            sections: [
                {
                    id: 'bulk_actions',
                    title: 'Bulk Operations',
                    items: [
                        { id: 'export_bulk', label: 'Export Selected (CSV)', icon: 'download', action: 'export_bulk' },
                        { id: 'delete_bulk', label: 'Delete Selected', icon: 'trash', action: 'delete_bulk', separator: true },
                    ],
                },
            ],
        },
    });
});

/**
 * GET /api/context-menus/:entityType/:entityId — dynamic entity context menu options.
 */
router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;

    const buildFarmerMenu = () => ({
        entityType,
        entityId,
        sections: [
            {
                id: 'quick_actions',
                title: 'Quick Actions',
                items: [
                    { id: 'view_farmer', label: 'View Profile', icon: 'eye', action: 'view_farmer' },
                    { id: 'schedule_visit', label: 'Schedule Visit', icon: 'calendar', action: 'schedule_visit' },
                ],
            },
            {
                id: 'sharing',
                title: 'Share & Export',
                items: [
                    { id: 'share_farmer', label: 'Share Profile', icon: 'share', action: 'share_farmer' },
                    { id: 'export_farmer', label: 'Export Data (CSV)', icon: 'download', action: 'export_farmer' },
                ],
            },
            {
                id: 'danger',
                title: 'Danger Zone',
                items: [
                    { id: 'delete_farmer', label: 'Delete Farmer', icon: 'trash', action: 'delete_farmer', separator: true },
                ],
            },
        ],
    });

    const buildVisitMenu = () => ({
        entityType,
        entityId,
        sections: [
            {
                id: 'visit_actions',
                title: 'Visit Actions',
                items: [
                    { id: 'view_visit', label: 'View Visit Details', icon: 'eye', action: 'view_visit' },
                    { id: 'share_visit', label: 'Share Visit', icon: 'share', action: 'share_visit' },
                    { id: 'delete_visit', label: 'Delete Record', icon: 'trash', action: 'delete_visit', separator: true },
                ],
            },
        ],
    });

    const buildReportMenu = () => ({
        entityType,
        entityId,
        sections: [
            {
                id: 'report_actions',
                title: 'Report Actions',
                items: [
                    { id: 'view_report', label: 'View Report', icon: 'eye', action: 'view_report' },
                    { id: 'export_report', label: 'Download Report', icon: 'download', action: 'export_report' },
                    { id: 'share_report', label: 'Share Report', icon: 'share', action: 'share_report' },
                ],
            },
        ],
    });

    const buildKnowledgeMenu = () => ({
        entityType,
        entityId,
        sections: [
            {
                id: 'knowledge_actions',
                title: 'Article Actions',
                items: [
                    { id: 'view_knowledge', label: 'Read Article', icon: 'note', action: 'view_knowledge' },
                    { id: 'share_knowledge', label: 'Share Article', icon: 'share', action: 'share_knowledge' },
                ],
            },
        ],
    });

    switch (entityType) {
        case 'farmer':
            return res.json({ success: true, data: buildFarmerMenu() });
        case 'visit':
            return res.json({ success: true, data: buildVisitMenu() });
        case 'report':
            return res.json({ success: true, data: buildReportMenu() });
        case 'knowledge':
            return res.json({ success: true, data: buildKnowledgeMenu() });
        default:
            return res.json({
                success: true,
                data: {
                    entityType,
                    entityId,
                    sections: [
                        {
                            id: 'default_actions',
                            items: [
                                { id: `view_${entityType}`, label: 'View Details', icon: 'eye', action: `view_${entityType}` },
                                { id: `share_${entityType}`, label: 'Share', icon: 'share', action: `share_${entityType}` },
                            ],
                        },
                    ],
                },
            });
    }
});

export default router;
