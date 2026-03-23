import { Router, Request, Response } from 'express';
import { Farmer } from '@prisma/client';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { createFarmerSchema } from '@/utils/schemas';
import { getPrisma } from '@/services/prismaService';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication to all farmers routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

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
        const { region: queryRegion, search, limit = '50', offset = '0' } = req.query;
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

        // Search and manual region filters
        if (queryRegion) {
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
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
        });

        res.json({
            success: true,
            data: {
                farmers: farmers.map((f: Farmer) => ({
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
                })),
                total: farmers.length, 
            },
        });
    } catch (error) {
        logger.error('Get farmers error:', error);
        res.status(500).json({ success: false, error: 'Failed to get farmers' });
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
        res.status(500).json({ success: false, error: 'Failed to get farmer' });
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
        res.status(500).json({ success: false, error: 'Failed to create farmer' });
    }
});

// Update farmer
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
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
        res.status(500).json({ success: false, error: 'Failed to update farmer' });
    }
});

export default router;
