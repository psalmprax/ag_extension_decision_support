/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { fieldSchemas, cropCycleSchemas } from '@/schemas';
import { getPrisma } from '@/services/prismaService';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Require authorization for fields & crops lifecycle
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

/**
 * Helper function to verify user can access a specific farmer's data
 */
async function checkFarmerAccess(farmerId: string, req: Request): Promise<boolean> {
    const { userId, role } = req.user as any;
    const prisma = getPrisma();

    if (role === 'admin') return true;

    const farmer = await prisma.farmer.findUnique({
        where: { id: farmerId },
        select: { userId: true, assignedOfficerId: true, region: true },
    });

    if (!farmer) return false;

    if (role === 'extension_officer') {
        return farmer.assignedOfficerId === userId;
    }

    if (role === 'farmer') {
        return farmer.userId === userId;
    }

    if (role === 'regional_manager') {
        const manager = await prisma.user.findUnique({
            where: { id: userId },
            select: { region: true },
        });
        return manager?.region === farmer.region;
    }

    return false;
}

/**
 * Helper function to verify user can access a specific field's data
 */
async function checkFieldAccess(fieldId: string, req: Request): Promise<boolean> {
    const prisma = getPrisma();
    const field = await prisma.field.findUnique({
        where: { id: fieldId },
        select: { farmerId: true },
    });

    if (!field) return false;

    return checkFarmerAccess(field.farmerId, req);
}

/**
 * GET /api/fields
 * List fields, optionally filtered by farmerId
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { farmerId } = req.query;
        const prisma = getPrisma();

        const where: any = { isActive: true };

        if (farmerId) {
            const hasAccess = await checkFarmerAccess(farmerId as string, req);
            if (!hasAccess) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            where.farmerId = farmerId as string;
        } else {
            // If no farmerId specified, filter based on user role
            const { userId, role } = req.user as any;
            if (role === 'extension_officer') {
                where.farmer = { assignedOfficerId: userId };
            } else if (role === 'farmer') {
                where.farmer = { userId };
            } else if (role === 'regional_manager') {
                const manager = await prisma.user.findUnique({ where: { id: userId }, select: { region: true } });
                if (manager?.region) {
                    where.farmer = { region: manager.region };
                }
            }
            // admin gets all fields if not filtered
        }

        const fields = await prisma.field.findMany({
            where,
            include: {
                cropCycles: {
                    orderBy: { plantingDate: 'desc' },
                },
            },
            orderBy: { name: 'asc' },
        });

        res.json({
            success: true,
            data: fields,
        });
    } catch (error) {
        logger.error('Get fields error:', error);
        safeError(res, 500, 'Failed to retrieve fields');
    }
});

/**
 * GET /api/fields/:id
 * Retrieve details of a single field, including crop cycles
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const prisma = getPrisma();

        const field = await prisma.field.findUnique({
            where: { id },
            include: {
                cropCycles: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!field) {
            return res.status(404).json({ success: false, error: 'Field not found' });
        }

        const hasAccess = await checkFarmerAccess(field.farmerId, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        res.json({
            success: true,
            data: field,
        });
    } catch (error) {
        logger.error('Get field details error:', error);
        safeError(res, 500, 'Failed to retrieve field details');
    }
});

/**
 * POST /api/fields
 * Create a new field for a farmer
 */
router.post('/', validate(fieldSchemas.create), async (req: Request, res: Response) => {
    try {
        const { farmerId, name, areaHectares, soilType, soilPh, boundaryCoordinates } = req.body;
        const prisma = getPrisma();

        const hasAccess = await checkFarmerAccess(farmerId, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied to create field for this farmer' });
        }

        const field = await prisma.field.create({
            data: {
                farmerId,
                name,
                areaHectares,
                soilType,
                soilPh,
                boundaryCoordinates: boundaryCoordinates || null,
            },
        });

        res.status(201).json({
            success: true,
            data: field,
        });
    } catch (error) {
        logger.error('Create field error:', error);
        safeError(res, 500, 'Failed to create field');
    }
});

/**
 * PATCH /api/fields/:id
 * Update field properties
 */
router.patch('/:id', validate(fieldSchemas.update), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, areaHectares, soilType, soilPh, boundaryCoordinates, isActive } = req.body;
        const prisma = getPrisma();

        const hasAccess = await checkFieldAccess(id, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const field = await prisma.field.update({
            where: { id },
            data: {
                name,
                areaHectares,
                soilType,
                soilPh,
                boundaryCoordinates,
                isActive,
            },
        });

        res.json({
            success: true,
            data: field,
        });
    } catch (error) {
        logger.error('Update field error:', error);
        safeError(res, 500, 'Failed to update field');
    }
});

/**
 * DELETE /api/fields/:id
 * Delete a field (soft delete or hard delete depending on preference, we do soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const prisma = getPrisma();

        const hasAccess = await checkFieldAccess(id, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Soft delete
        const field = await prisma.field.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({
            success: true,
            message: 'Field deleted successfully',
            data: field,
        });
    } catch (error) {
        logger.error('Delete field error:', error);
        safeError(res, 500, 'Failed to delete field');
    }
});

/**
 * GET /api/fields/:id/cycles
 * Get crop cycles for a field
 */
router.get('/:id/cycles', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const prisma = getPrisma();

        const hasAccess = await checkFieldAccess(id, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const cycles = await prisma.cropCycle.findMany({
            where: { fieldId: id },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: cycles,
        });
    } catch (error) {
        logger.error('Get crop cycles error:', error);
        safeError(res, 500, 'Failed to retrieve crop cycles');
    }
});

/**
 * POST /api/fields/:id/cycles
 * Create a new crop cycle for a field
 */
router.post('/:id/cycles', validate(cropCycleSchemas.create), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { cropName, variety, status, plantingDate, expectedHarvestDate, notes } = req.body;
        const prisma = getPrisma();

        const hasAccess = await checkFieldAccess(id, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const cycle = await prisma.cropCycle.create({
            data: {
                fieldId: id,
                cropName,
                variety,
                status: status || 'planned',
                plantingDate: plantingDate ? new Date(plantingDate) : null,
                expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : null,
                notes,
            },
        });

        res.status(201).json({
            success: true,
            data: cycle,
        });
    } catch (error) {
        logger.error('Create crop cycle error:', error);
        safeError(res, 500, 'Failed to create crop cycle');
    }
});

/**
 * PATCH /api/fields/:id/cycles/:cycleId
 * Update/end a crop cycle (record harvest and yield)
 */
router.patch('/:id/cycles/:cycleId', validate(cropCycleSchemas.update), async (req: Request, res: Response) => {
    try {
        const { id, cycleId } = req.params;
        const { cropName, variety, status, plantingDate, expectedHarvestDate, actualHarvestDate, yieldKg, notes } = req.body;
        const prisma = getPrisma();

        const hasAccess = await checkFieldAccess(id, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const cycle = await prisma.cropCycle.update({
            where: { id: cycleId },
            data: {
                cropName,
                variety,
                status,
                plantingDate: plantingDate ? new Date(plantingDate) : undefined,
                expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : undefined,
                actualHarvestDate: actualHarvestDate ? new Date(actualHarvestDate) : undefined,
                yieldKg,
                notes,
            },
        });

        res.json({
            success: true,
            data: cycle,
        });
    } catch (error) {
        logger.error('Update crop cycle error:', error);
        safeError(res, 500, 'Failed to update crop cycle');
    }
});

/**
 * DELETE /api/fields/:id/cycles/:cycleId
 * Delete a crop cycle
 */
router.delete('/:id/cycles/:cycleId', async (req: Request, res: Response) => {
    try {
        const { id, cycleId } = req.params;
        const prisma = getPrisma();

        const hasAccess = await checkFieldAccess(id, req);
        if (!hasAccess) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        await prisma.cropCycle.delete({
            where: { id: cycleId },
        });

        res.json({
            success: true,
            message: 'Crop cycle deleted successfully',
        });
    } catch (error) {
        logger.error('Delete crop cycle error:', error);
        safeError(res, 500, 'Failed to delete crop cycle');
    }
});

export default router;
