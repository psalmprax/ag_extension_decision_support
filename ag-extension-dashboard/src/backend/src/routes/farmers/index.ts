import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import crudRouter from './crud';
import bulkRouter from './bulk';
import importExportRouter from './importExport';
import { createShareRoute } from '../shareRouteFactory';

const router = Router();

// Apply authentication to all farmers routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

router.use(crudRouter);

/**
 * @openapi
 * /api/farmers/{id}/share:
 *   post:
 *     summary: Create a share link for a farmer
 *     tags: [Farmers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
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
router.use(createShareRoute('farmer'));

router.use(bulkRouter);
router.use(importExportRouter);

export default router;
