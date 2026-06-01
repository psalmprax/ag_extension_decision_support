/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { contextMenuService, UserPermissions } from '@/services/contextMenuService';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all context menu routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Helper function to extract user permissions
const getUserPermissions = (req: Request): UserPermissions => {
    const user = req.user;
    if (!user) {
        throw new Error('User not authenticated');
    }

    // Map roles to permissions (this could be expanded based on your permission system)
    const rolePermissions: Record<UserRole, string[]> = {
        admin: ['manage_farmers', 'manage_visits', 'manage_reports', 'manage_knowledge', 'manage_users', 'delete_farmers', 'delete_visits', 'delete_reports', 'delete_knowledge', 'delete_users', 'export_data', 'schedule_visits', 'publish_knowledge'],
        regional_manager: ['manage_farmers', 'manage_visits', 'manage_reports', 'manage_knowledge', 'delete_farmers', 'delete_visits', 'delete_reports', 'delete_knowledge', 'export_data', 'schedule_visits', 'publish_knowledge'],
        extension_officer: ['manage_visits', 'manage_reports', 'delete_visits', 'delete_reports', 'export_data', 'schedule_visits'],
        farmer: ['view_own_data', 'export_own_data']
    };

    return {
        userId: user.userId,
        role: user.role,
        permissions: rolePermissions[user.role] || []
    };
};

// Get context menu for a specific entity
router.get('/:entityType/:entityId', async (req: Request, res: Response) => {
    try {
        const { entityType, entityId } = req.params;
        const { bulk } = req.query;

        if (!['farmer', 'visit', 'report', 'knowledge', 'user'].includes(entityType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid entity type'
            });
        }

        const userPermissions = getUserPermissions(req);
        const isBulk = bulk === 'true';

        const menu = await contextMenuService.generateContextMenu(
            entityType as any,
            entityId,
            userPermissions,
            isBulk
        );

        res.json({
            success: true,
            data: menu
        });
    } catch (error) {
        logger.error('Get context menu error:', error);
        safeError(res, 500, 'Failed to get context menu');
    }
});

// Get bulk action context menu for an entity type
router.get('/bulk/:entityType', async (req: Request, res: Response) => {
    try {
        const { entityType } = req.params;

        if (!['farmer', 'visit', 'report', 'knowledge', 'user'].includes(entityType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid entity type'
            });
        }

        const userPermissions = getUserPermissions(req);

        const menu = await contextMenuService.generateContextMenu(
            entityType as any,
            null,
            userPermissions,
            true
        );

        res.json({
            success: true,
            data: menu
        });
    } catch (error) {
        logger.error('Get bulk context menu error:', error);
        safeError(res, 500, 'Failed to get bulk context menu');
    }
});

// Execute a context menu action
router.post('/action', async (req: Request, res: Response) => {
    try {
        const { action, entityType, entityId, data } = req.body;

        if (!action || !entityType || !entityId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: action, entityType, entityId'
            });
        }

        if (!['farmer', 'visit', 'report', 'knowledge', 'user'].includes(entityType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid entity type'
            });
        }

        const userPermissions = getUserPermissions(req);

        // Additional authorization check for sensitive actions
        if (action.includes('delete') || action.includes('edit')) {
            const isOwner = await contextMenuService['checkEntityOwnership'](entityType, entityId, userPermissions.userId);
            if (!isOwner && !['admin', 'regional_manager'].includes(userPermissions.role)) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions'
                });
            }
        }

        const result = await contextMenuService.executeAction(
            action,
            entityType,
            entityId,
            userPermissions.userId,
            data
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Execute context menu action error:', error);
        safeError(res, 500, 'Failed to execute action');
    }
});

// Get available actions for an entity type (for frontend validation)
router.get('/actions/:entityType', async (req: Request, res: Response) => {
    try {
        const { entityType } = req.params;

        if (!['farmer', 'visit', 'report', 'knowledge', 'user'].includes(entityType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid entity type'
            });
        }

        const userPermissions = getUserPermissions(req);

        // Generate menu to extract available actions
        const menu = await contextMenuService.generateContextMenu(
            entityType as any,
            'dummy', // We just need the structure
            userPermissions,
            false
        );

        // Extract all unique actions from the menu
        const actions = new Set<string>();
        const extractActions = (items: any[]) => {
            items.forEach(item => {
                if (item.action && !item.separator) {
                    actions.add(item.action);
                }
                if (item.children) {
                    extractActions(item.children);
                }
            });
        };

        menu.sections.forEach(section => {
            extractActions(section.items);
        });

        res.json({
            success: true,
            data: {
                entityType,
                actions: Array.from(actions)
            }
        });
    } catch (error) {
        logger.error('Get available actions error:', error);
        safeError(res, 500, 'Failed to get available actions');
    }
});

export default router;