/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
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
 */
// Get all farmers
router.get('/', async (req: Request, res: Response) => {
    try {
        const { region, search, limit = '50', offset = '0' } = req.query;
        const prisma = getPrisma();

        const where: any = {};
        if (region) {
            where.region = region as string;
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
                farmers: farmers.map(f => ({
                    id: f.id,
                    firstName: f.firstName,
                    lastName: f.lastName,
                    phone: f.phone,
                    region: f.region,
                    village: f.village,
                    crops: f.crops,
                    farmSize: f.farmSizeHectares,
                    languagePreference: f.languagePreference,
                })),
                total: farmers.length, // In a real app, you'd want a count query separately
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
        const prisma = getPrisma();

        const farmer = await prisma.farmer.findUnique({
            where: { id },
        });

        if (!farmer) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }

        res.json({
            success: true,
            data: {
                id: farmer.id,
                firstName: farmer.firstName,
                lastName: farmer.lastName,
                phone: farmer.phone,
                email: null, // Since we don't have email in the schema yet matching exactly what was there
                location: {
                    region: farmer.region,
                    district: farmer.district,
                    village: farmer.village,
                    lat: null, // location_lat was Decimal, we should probably add it back or map it
                    lng: null,
                },
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
 *     responses:
 *       201:
 *         description: Farmer created
 */
// Create farmer
router.post('/', validate(createFarmerSchema), async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, phone, region, village, farmSize, crops, languagePreference } = req.body;
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
            },
        });

        res.status(201).json({ success: true, data: farmer });
    } catch (error) {
        logger.error('Create farmer error:', error);
        res.status(500).json({ success: false, error: 'Failed to create farmer' });
    }
});

// Update farmer
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, phone, region, village, farmSize, crops, languagePreference } = req.body;
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
                updatedAt: new Date(),
            },
        });

        res.json({ success: true, data: farmer });
    } catch (error) {
        logger.error('Update farmer error:', error);
        res.status(500).json({ success: false, error: 'Failed to update farmer' });
    }
});

export default router;
