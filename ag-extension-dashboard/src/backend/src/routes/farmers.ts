/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { Farmer } from '@prisma/client';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { createFarmerSchema, updateFarmerSchema } from '@/utils/schemas';
import { getPrisma } from '@/services/prismaService';
import { authorize } from '@/middleware/authorize';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all farmers routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

/**
 * @openapi
 * /api/farmers:
 *   get:
 *     summary: Get all farmers
 *     tags: [Farmers]
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: mobile
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return mobile-optimized response with fewer fields
 *     responses:
 *       200:
 *         description: List of farmers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     farmers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Farmer'
 *                     total: { type: integer }
 */
// Get all farmers
router.get('/', async (req: Request, res: Response) => {
    try {
        const { region: queryRegion, search, limit = '50', offset = '0', mobile = 'false' } = req.query;
        const { userId, role } = req.user as any;
        const prisma = getPrisma();

        const where: any = {};

        // Role-based filtering
        if (role === 'extension_officer') {
            where.assignedOfficerId = userId;
        } else if (role === 'regional_manager') {
            // Fetch manager's region
            const manager = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
            if (manager?.region) {
                where.region = manager.region;
            }
        } else if (role === 'farmer') {
            where.userId = userId;
        }

        // Manual region filter (only for admin — other roles already filtered above)
        if (queryRegion && role === 'admin') {
            where.region = queryRegion as string;
        }
        if (search) {
            where.OR = [
                { firstName: { contains: search as string, mode: 'insensitive' } },
                { lastName: { contains: search as string, mode: 'insensitive' } },
                { village: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const farmers = await prisma.farmer.findMany({
            where,
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' }
            ],
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
        });

        const isMobile = mobile === 'true';
        const farmerData = farmers.map((f: Farmer) => {
            if (isMobile) {
                // Mobile-optimized: fewer fields
                return {
                    id: f.id,
                    firstName: f.firstName,
                    lastName: f.lastName,
                    phone: f.phone,
                    region: f.region,
                    village: f.village,
                    vitalScore: f.vitalScore,
                };
            } else {
                // Full data for desktop
                return {
                    id: f.id,
                    firstName: f.firstName,
                    lastName: f.lastName,
                    phone: f.phone,
                    region: f.region,
                    village: f.village,
                    crops: f.crops,
                    farmSize: f.farmSizeHectares,
                    vitalScore: f.vitalScore,
                    yieldHistory: f.yieldHistory,
                    locationLat: f.locationLat,
                    locationLng: f.locationLng,
                    languagePreference: f.languagePreference,
                };
            }
        });

        res.json({
            success: true,
            data: {
                farmers: farmerData,
                total: farmers.length,
            },
            aria: {
                role: 'list',
                label: `${farmers.length} farmers loaded successfully`,
                itemCount: farmers.length
            },
            mobile: isMobile
        });
    } catch (error) {
        logger.error('Get farmers error:', error);
        safeError(res, 500, 'Failed to get farmers');
    }
});

/**
 * @openapi
 * /api/farmers/{id}:
 *   get:
 *     summary: Get farmer by ID
 *     tags: [Farmers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Farmer details
 *       404:
 *         description: Farmer not found
 */
// Get farmer by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user as any;
        const prisma = getPrisma();

        const farmer = await prisma.farmer.findUnique({
            where: { id },
        });

        if (!farmer) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }

        // Ownership/Visibility check
        if (role === 'extension_officer' && farmer.assignedOfficerId !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        if (role === 'farmer' && farmer.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        if (role === 'regional_manager') {
            const manager = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
            if (manager?.region && farmer.region !== manager.region) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        }

        res.json({
            success: true,
            data: {
                id: farmer.id,
                firstName: farmer.firstName,
                lastName: farmer.lastName,
                phone: farmer.phone,
                email: null, // Since we don't have email in the schema yet matching exactly what was there
                locationLat: farmer.locationLat,
                locationLng: farmer.locationLng,
                region: farmer.region,
                district: farmer.district,
                village: farmer.village,
                vitalScore: farmer.vitalScore,
                yieldHistory: farmer.yieldHistory,
                farmSize: farmer.farmSizeHectares,
                crops: farmer.crops,
                languagePreference: farmer.languagePreference || 'en',
                createdAt: farmer.createdAt,
                lastVisit: null,
            },
        });
    } catch (error) {
        logger.error('Get farmer error:', error);
        safeError(res, 500, 'Failed to get farmer');
    }
});

/**
 * @openapi
 * /api/farmers:
 *   post:
 *     summary: Create a new farmer
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               region: { type: string }
 *               village: { type: string }
 *               farmSize: { type: number }
 *               crops: { type: array, items: { type: string } }
 *               languagePreference: { type: string }
 *               vitalScore: { type: number }
 *               yieldHistory: { type: object }
 *               locationLat: { type: number }
 *               locationLng: { type: number }
 *     responses:
 *       201:
 *         description: Farmer created
 */
// Create farmer
router.post('/', validate(createFarmerSchema), async (req: Request, res: Response) => {
    try {
        const {
            firstName, lastName, phone, region, village,
            farmSize, crops, languagePreference,
            vitalScore, yieldHistory, locationLat, locationLng
        } = req.body;
        const prisma = getPrisma();

        const farmer = await prisma.farmer.create({
            data: {
                firstName,
                lastName,
                phone,
                region,
                village,
                farmSizeHectares: farmSize,
                crops,
                languagePreference: languagePreference || 'en',
                vitalScore,
                yieldHistory,
                locationLat,
                locationLng,
            },
        });

        res.status(201).json({
            success: true,
            data: {
                id: farmer.id,
                firstName: farmer.firstName,
                lastName: farmer.lastName,
                phone: farmer.phone,
                region: farmer.region,
                village: farmer.village,
                crops: farmer.crops,
                farmSize: farmer.farmSizeHectares,
                vitalScore: farmer.vitalScore,
                yieldHistory: farmer.yieldHistory,
                locationLat: farmer.locationLat,
                locationLng: farmer.locationLng,
                languagePreference: farmer.languagePreference,
            }
        });
    } catch (error) {
        logger.error('Create farmer error:', error);
        safeError(res, 500, 'Failed to create farmer');
    }
});

/**
 * @swagger
 * /api/farmers/{id}:
 *   patch:
 *     summary: Update farmer details
 *     tags: [Farmers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Farmer'
 *     responses:
 *       200:
 *         description: Farmer updated
 *       404:
 *         description: Farmer not found
 */
// Update farmer
router.patch('/:id', validate(updateFarmerSchema), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userRole = (req as any).user?.role;
        const userId = (req as any).user?.userId;

        // Ownership check: admin/regional_manager can edit any, others only their own or assigned
        if (userRole !== 'admin' && userRole !== 'regional_manager') {
            const prisma = getPrisma();
            const existing = await prisma.farmer.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ success: false, error: 'Farmer not found' });
            }
            const isOwner = existing.userId === userId;
            const isAssignedOfficer = existing.assignedOfficerId === userId;
            if (!isOwner && !isAssignedOfficer) {
                return res.status(403).json({ success: false, error: 'Not authorized to update this farmer' });
            }
        }

        const {
            firstName, lastName, phone, region, village,
            farmSize, crops, languagePreference,
            vitalScore, yieldHistory, locationLat, locationLng
        } = req.body;
        const prisma = getPrisma();

        const farmer = await prisma.farmer.update({
            where: { id },
            data: {
                firstName,
                lastName,
                phone,
                region,
                village,
                farmSizeHectares: farmSize,
                crops,
                languagePreference,
                vitalScore,
                yieldHistory,
                locationLat,
                locationLng,
                updatedAt: new Date(),
            },
        });

        res.json({
            success: true,
            data: {
                id: farmer.id,
                firstName: farmer.firstName,
                lastName: farmer.lastName,
                phone: farmer.phone,
                region: farmer.region,
                village: farmer.village,
                crops: farmer.crops,
                farmSize: farmer.farmSizeHectares,
                vitalScore: farmer.vitalScore,
                yieldHistory: farmer.yieldHistory,
                locationLat: farmer.locationLat,
                locationLng: farmer.locationLng,
                languagePreference: farmer.languagePreference,
            }
        });
    } catch (error) {
        logger.error('Update farmer error:', error);
        safeError(res, 500, 'Failed to update farmer');
    }
});

import { createShareRoute } from './shareRouteFactory';

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
        const { userId, role } = req.user as any;
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
        for (const farmer of farmers) {
            if (role === 'extension_officer' && farmer.assignedOfficerId !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied to some farmers',
                    aria: { role: 'alert', label: 'Reorder failed: Access denied' }
                });
            }
            if (role === 'farmer' && farmer.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied to some farmers',
                    aria: { role: 'alert', label: 'Reorder failed: Access denied' }
                });
            }
            if (role === 'regional_manager') {
                const manager = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
                if (manager?.region && farmer.region !== manager.region) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied to some farmers',
                        aria: { role: 'alert', label: 'Reorder failed: Access denied' }
                    });
                }
            }
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
        const { userId, role } = req.user as any;

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
        const { userId, role } = req.user as any;

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

/**
 * @openapi
 * /api/farmers/export:
 *   get:
 *     summary: Export farmers to CSV
 *     tags: [Farmers]
 *     parameters:
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV export
 *         content:
 *           text/csv:
 *             schema: { type: string }
 */
router.get('/export', async (req: Request, res: Response) => {
    try {
        const { region, search } = req.query;
        const { userId, role } = req.user as any;

        const csvData = await bulkOperationsService.exportFarmersToCSV(
            { region: region as string, search: search as string },
            userId,
            role
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="farmers_export.csv"');
        res.send(csvData);
    } catch (error) {
        logger.error('Export farmers error:', error);
        safeError(res, 500, 'Failed to export farmers');
    }
});

/**
 * @openapi
 * /api/farmers/import:
 *   post:
 *     summary: Import farmers from CSV
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing farmer data
 *     responses:
 *       200:
 *         description: Import result
 */
router.post('/import', async (req: Request, res: Response) => {
    try {
        // Note: File upload middleware should be added to handle multipart/form-data
        // For now, assuming CSV content is sent in request body
        const csvData = req.body.csv || req.body;
        const { userId, role } = req.user as any;

        if (!csvData || typeof csvData !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'CSV data is required'
            });
        }

        const result = await bulkOperationsService.importFarmersFromCSV(
            csvData,
            userId,
            role
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Import farmers error:', error);
        safeError(res, 500, 'Failed to import farmers');
    }
});

export default router;
