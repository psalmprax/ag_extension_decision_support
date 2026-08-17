import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { shareService } from '@/services/shareService';
import { safeError } from '@/utils/safeResponse';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

const router = Router();

// Apply authentication to all share management routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

/**
 * @openapi
 * /api/shares:
 *   post:
 *     summary: Create a new share link
 *     tags: [Shares]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entityType
 *               - entityId
 *             properties:
 *               entityType:
 *                 type: string
 *                 enum: [farmer, visit, report, knowledge]
 *               entityId:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Share link created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     url: { type: string }
 *                     expiresAt: { type: string, format: date-time }
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { entityType, entityId, isPublic, expiresAt, permissions } = req.body;
        const createdBy = req.user?.userId;
        const tenantId = createdBy ? await getPrincipalTenantId(createdBy) : null;
        if (!createdBy || !tenantId) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }

        const shareLink = await shareService.createShare({
            entityType,
            entityId,
            createdBy,
            tenantId,
            isPublic,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            permissions,
        });

        res.status(201).json({
            success: true,
            data: shareLink,
        });
    } catch (error) {
        logger.error('Error creating share:', error);
        safeError(res, 500, 'Failed to create share link');
    }
});

/**
 * @openapi
 * /api/shares:
 *   get:
 *     summary: Get shares created by current user
 *     tags: [Shares]
 *     responses:
 *       200:
 *         description: List of shares
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       token: { type: string }
 *                       entityType: { type: string }
 *                       entityId: { type: string }
 *                       isPublic: { type: boolean }
 *                       expiresAt: { type: string, format: date-time }
 *                       permissions: { type: array, items: { type: string } }
 *                       accessCount: { type: integer }
 *                       lastAccessedAt: { type: string, format: date-time }
 *                       createdAt: { type: string, format: date-time }
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const creatorId = req.user?.userId;
        const tenantId = creatorId ? await getPrincipalTenantId(creatorId) : null;
        if (!creatorId || !tenantId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated',
            });
        }

        const shares = await shareService.getSharesByCreator(creatorId, tenantId);

        res.json({
            success: true,
            data: shares,
        });
    } catch (error) {
        logger.error('Error getting shares:', error);
        safeError(res, 500, 'Failed to get shares');
    }
});

/**
 * @openapi
 * /api/shares/{token}:
 *   delete:
 *     summary: Delete a share link
 *     tags: [Shares]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Share deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 */
router.delete('/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const creatorId = req.user?.userId;
        const tenantId = creatorId ? await getPrincipalTenantId(creatorId) : null;

        if (!creatorId || !tenantId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated',
            });
        }

        const deleted = await shareService.deleteShare(token, creatorId, tenantId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Share not found or not authorized',
            });
        }

        res.json({
            success: true,
        });
    } catch (error) {
        logger.error('Error deleting share:', error);
        safeError(res, 500, 'Failed to delete share');
    }
});

/**
 * @openapi
 * /api/shares/{token}/email:
 *   post:
 *     summary: Share via email
 *     tags: [Shares]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 */
router.post('/:token/email', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { recipients, message } = req.body;

        if (!Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Recipients array is required',
            });
        }

        const creatorId = req.user?.userId;
        const tenantId = creatorId ? await getPrincipalTenantId(creatorId) : null;
        if (!creatorId || !tenantId || !(await shareService.canManageShare(token, creatorId, tenantId))) {
            return res.status(404).json({ success: false, error: 'Share not found or not authorized' });
        }
        await shareService.shareViaEmail(token, recipients, message);

        res.json({
            success: true,
        });
    } catch (error) {
        logger.error('Error sharing via email:', error);
        safeError(res, 500, 'Failed to share via email');
    }
});

/**
 * @openapi
 * /api/shares/{token}/sms:
 *   post:
 *     summary: Share via SMS
 *     tags: [Shares]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: SMS sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 */
router.post('/:token/sms', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const { recipients, message } = req.body;

        if (!Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Recipients array is required',
            });
        }

        const creatorId = req.user?.userId;
        const tenantId = creatorId ? await getPrincipalTenantId(creatorId) : null;
        if (!creatorId || !tenantId || !(await shareService.canManageShare(token, creatorId, tenantId))) {
            return res.status(404).json({ success: false, error: 'Share not found or not authorized' });
        }
        await shareService.shareViaSMS(token, recipients, message);

        res.json({
            success: true,
        });
    } catch (error) {
        logger.error('Error sharing via SMS:', error);
        safeError(res, 500, 'Failed to share via SMS');
    }
});

// Public route for accessing shared content (no authentication required)
const publicRouter = Router();

/**
 * @openapi
 * /api/public/shares/{token}:
 *   get:
 *     summary: Access shared content
 *     tags: [Public Shares]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shared content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 */
publicRouter.get('/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        const data = await shareService.getShareData(token);

        res.json({
            success: true,
            data,
        });
    } catch (error) {
        logger.error('Error accessing shared content:', error);
        res.status(404).json({
            success: false,
            error: 'Shared content not found or access denied',
        });
    }
});

export { router as shareRouter, publicRouter as publicShareRouter };