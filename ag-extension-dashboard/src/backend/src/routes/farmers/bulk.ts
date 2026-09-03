import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { getPrisma } from '@/services/prismaService';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

async function verifyFarmersAccess(farmers: { assignedOfficerId: string | null; userId: string | null; region: string | null; id: string }[], role: string, userId: string, prisma: { user: { findUnique: (args: { where: { id: string }, select: { region: true } }) => Promise<{ region?: string | null } | null> } }): Promise<boolean> {
    for (const farmer of farmers) {
        if (role === 'extension_officer' && farmer.assignedOfficerId !== userId) {
            return false;
        }
        if (role === 'farmer' && farmer.userId !== userId) {
            return false;
        }
        if (role === 'regional_manager') {
            const manager = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
            if (manager?.region && farmer.region !== manager.region) {
                return false;
            }
        }
    }
    return true;
}

/**
 * @openapi
 * /api/farmers/reorder:
 *   post:
 *     summary: Reorder farmers for drag-and-drop functionality
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, order]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     order: { type: integer }
 *     responses:
 *       200:
 *         description: Farmers reordered successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Access denied
 */
router.post('/reorder', async (req: Request, res: Response) => {
    try {
        const { items } = req.body;
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);
        const prisma = getPrisma();

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required',
                aria: { role: 'alert', label: 'Reorder failed: Invalid data provided' }
            });
        }

        // Validate each item has id and order
        for (const item of items) {
            if (!item.id || typeof item.order !== 'number') {
                return res.status(400).json({
                    success: false,
                    error: 'Each item must have id and order',
                    aria: { role: 'alert', label: 'Reorder failed: Invalid item format' }
                });
            }
        }

        // Get farmer IDs to check ownership
        const farmerIds = items.map(item => item.id);
        const farmers = await prisma.farmer.findMany({
            where: { id: { in: farmerIds } },
            select: { id: true, assignedOfficerId: true, userId: true, region: true }
        });

        if (farmers.length !== items.length) {
            return res.status(400).json({
                success: false,
                error: 'Some farmers not found',
                aria: { role: 'alert', label: 'Reorder failed: Some farmers not found' }
            });
        }

        // Role-based access control
        const hasAccess = await verifyFarmersAccess(farmers, role, userId, prisma);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to some farmers',
                aria: { role: 'alert', label: 'Reorder failed: Access denied' }
            });
        }

        // Update orders in transaction
        await prisma.$transaction(
            items.map(item =>
                prisma.farmer.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        );

        res.json({
            success: true,
            message: 'Farmers reordered successfully',
            aria: { role: 'status', label: 'Farmers reordered successfully' }
        });
    } catch (error) {
        logger.error('Reorder farmers error:', error);
        safeError(res, 500, 'Internal server error');
    }
});

/**
 * @openapi
 * /api/farmers/bulk/delete:
 *   post:
 *     summary: Bulk delete farmers
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Bulk delete result
 */
router.post('/bulk/delete', async (req: Request, res: Response) => {
    try {
        const { ids, reason } = req.body;
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IDs array is required and cannot be empty'
            });
        }

        // Only admins and regional managers can perform bulk operations
        if (!['admin', 'regional_manager'].includes(role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for bulk operations'
            });
        }

        const result = await bulkOperationsService.bulkDeleteFarmers(
            { ids, reason },
            userId,
            role
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Bulk delete farmers error:', error);
        safeError(res, 500, 'Failed to perform bulk delete operation');
    }
});

/**
 * @openapi
 * /api/farmers/bulk/update:
 *   post:
 *     summary: Bulk update farmers
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, updates]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *               updates:
 *                 type: object
 *                 properties:
 *                   region: { type: string }
 *                   village: { type: string }
 *                   languagePreference: { type: string }
 *                   vitalScore: { type: number }
 *                   crops: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Bulk update result
 */
router.post('/bulk/update', async (req: Request, res: Response) => {
    try {
        const { ids, updates } = req.body;
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'IDs array is required and cannot be empty'
            });
        }

        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Updates object is required'
            });
        }

        // Only admins and regional managers can perform bulk operations
        if (!['admin', 'regional_manager'].includes(role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions for bulk operations'
            });
        }

        const result = await bulkOperationsService.bulkUpdateFarmers(
            { ids, updates },
            userId,
            role
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Bulk update farmers error:', error);
        safeError(res, 500, 'Failed to perform bulk update operation');
    }
});

export default router;
