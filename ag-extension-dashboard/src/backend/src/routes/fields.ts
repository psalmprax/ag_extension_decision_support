import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/services/prismaService';
import { query } from '@/services/databaseService';
import type { CountRow, FieldStatsRow } from '@/types/rowTypes';
import { mapFieldStatsRows, mapCountRow } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { UUID_REGEX } from '@/utils/uuid';

const router = Router();

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

/**
 * GET /api/fields — list fields. Officers and farmers are auto-filtered by
 * Prisma's `where` clause; admins/managers see everything.
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const prisma = getPrisma();
        const { farmerId } = req.query;
        const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);
        const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);
        const user = req.user as { userId?: string; role?: string } | undefined;

        const where: Prisma.FieldWhereInput = { isActive: true };
        if (user?.role === 'farmer') {
            const farmer = await prisma.farmer.findFirst({
                where: { userId: user.userId }
            });
            if (!farmer) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            if (farmerId && farmerId !== farmer.id) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            where.farmerId = farmer.id;
        } else {
            if (farmerId) {
                // Guard against malformed (non-UUID) farmerId — the column is a
                // UUID FK, so an invalid value would otherwise throw and 500.
                if (!UUID_REGEX.test(String(farmerId))) {
                    return res.json({ success: true, data: [], total: 0 });
                }
                where.farmerId = farmerId as string;
            }
        }

        const [fields, total] = await Promise.all([
            prisma.field.findMany({
                where,
                include: { farmer: { select: { firstName: true, lastName: true } } },
                take: limit,
                skip: offset,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.field.count({ where }),
        ]);

        return res.json({ success: true, data: fields, total });
    } catch (error) {
        logger.error('Failed to list fields:', error);
        return safeError(res, 500, 'Failed to list fields');
    }
});

/**
 * GET /api/fields/:id — single field detail.
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Field id is required' });
        }
        const prisma = getPrisma();
        const field = await prisma.field.findUnique({ where: { id } });
        if (!field) {
            return res.status(404).json({ success: false, error: 'Field not found' });
        }
        return res.json({ success: true, data: field });
    } catch (error) {
        logger.error('Failed to fetch field:', error);
        return safeError(res, 500, 'Failed to fetch field');
    }
});

/**
 * POST /api/fields — create a field. Schema-aligned to the Prisma Field model.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body as {
            farmer_id?: string;
            farmerId?: string;
            name?: string;
            area_hectares?: number;
            areaHectares?: number;
            soil_type?: string;
            soilType?: string;
            soil_ph?: number;
            soilPh?: number;
            boundary_coordinates?: Prisma.JsonValue;
            boundaryCoordinates?: Prisma.JsonValue;
        };
        const farmerId = body.farmerId || body.farmer_id;
        const name = body.name;
        const areaHectares = body.areaHectares !== undefined ? body.areaHectares : body.area_hectares;
        const soilType = body.soilType !== undefined ? body.soilType : body.soil_type;
        const soilPh = body.soilPh !== undefined ? body.soilPh : body.soil_ph;
        const boundaryCoordinates = body.boundaryCoordinates !== undefined ? body.boundaryCoordinates : body.boundary_coordinates;

        if (!farmerId || !name || typeof areaHectares !== 'number') {
            return res.status(400).json({ success: false, error: 'farmerId, name, and areaHectares are required' });
        }
        // farmer_id is a UUID FK — reject malformed ids up front. Mirrors the
        // shared createFieldSchema contract (see __tests__/apiContract.test.ts).
        if (!UUID_REGEX.test(String(farmerId))) {
            return res.status(400).json({ success: false, error: 'farmerId must be a valid UUID' });
        }
        const prisma = getPrisma();
        const field = await prisma.field.create({
            data: {
                farmerId,
                name,
                areaHectares,
                soilType: soilType ?? null,
                soilPh: soilPh ?? null,
                boundaryCoordinates: (boundaryCoordinates ?? null) as Prisma.InputJsonValue,
                isActive: true,
            },
        });
        return res.status(201).json({ success: true, data: field });
    } catch (error) {
        logger.error('Failed to create field:', error);
        return safeError(res, 500, 'Failed to create field');
    }
});

/**
 * PUT /api/fields/:id — update a field. Schema-aligned to the Prisma Field model.
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Field id is required' });
        }
        const body = req.body as Partial<{
            name: string;
            areaHectares: number;
            area_hectares: number;
            soilType: string;
            soil_type: string;
            soilPh: number;
            soil_ph: number;
            boundaryCoordinates: Prisma.JsonValue;
            boundary_coordinates: Prisma.JsonValue;
        }>;

        const prisma = getPrisma();
        const data: Prisma.FieldUpdateInput = {};
        if (body.name !== undefined) data.name = body.name;

        const areaHectares = body.areaHectares !== undefined ? body.areaHectares : body.area_hectares;
        if (areaHectares !== undefined) data.areaHectares = areaHectares;

        const soilType = body.soilType !== undefined ? body.soilType : body.soil_type;
        if (soilType !== undefined) data.soilType = soilType;

        const soilPh = body.soilPh !== undefined ? body.soilPh : body.soil_ph;
        if (soilPh !== undefined) data.soilPh = soilPh;

        const boundaryCoordinates = body.boundaryCoordinates !== undefined ? body.boundaryCoordinates : body.boundary_coordinates;
        if (boundaryCoordinates !== undefined) data.boundaryCoordinates = boundaryCoordinates as Prisma.InputJsonValue;

        const field = await prisma.field.update({ where: { id }, data });
        return res.json({ success: true, data: field });
    } catch (error) {
        logger.error('Failed to update field:', error);
        return safeError(res, 500, 'Failed to update field');
    }
});

/**
 * DELETE /api/fields/:id — soft-delete (isActive = false).
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Field id is required' });
        }
        const prisma = getPrisma();
        await prisma.field.update({ where: { id }, data: { isActive: false } });
        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete field:', error);
        return safeError(res, 500, 'Failed to delete field');
    }
});

/**
 * POST /api/fields/:fieldId/cycles — create crop cycle
 */
router.post('/:fieldId/cycles', async (req: Request, res: Response) => {
    try {
        const fieldId = req.params.fieldId;
        if (!fieldId) {
            return res.status(400).json({ success: false, error: 'fieldId is required' });
        }
        const body = req.body;
        const cropName = body.cropName || body.crop_name;
        const variety = body.variety ?? null;
        const status = body.status || 'planned';
        const plantingDate = body.plantingDate || body.planting_date ? new Date(body.plantingDate || body.planting_date) : null;
        const expectedHarvestDate = body.expectedHarvestDate || body.expected_harvest_date ? new Date(body.expectedHarvestDate || body.expected_harvest_date) : null;

        if (!cropName) {
            return res.status(400).json({ success: false, error: 'cropName is required' });
        }

        const prisma = getPrisma();
        const cycle = await prisma.cropCycle.create({
            data: {
                fieldId,
                cropName,
                variety,
                status,
                plantingDate,
                expectedHarvestDate,
            },
        });
        return res.status(201).json({ success: true, data: cycle });
    } catch (error) {
        logger.error('Failed to create crop cycle:', error);
        return safeError(res, 500, 'Failed to create crop cycle');
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCropCycleUpdate(body: any): Prisma.CropCycleUpdateInput {
    const data: Prisma.CropCycleUpdateInput = {};
    const getVal = (camel: string, snake: string) => body[camel] !== undefined ? body[camel] : body[snake];
    const getDateVal = (camel: string, snake: string) => {
        const val = getVal(camel, snake);
        return val ? new Date(val) : (val === null ? null : undefined);
    };

    const cropName = getVal('cropName', 'crop_name');
    if (cropName !== undefined) data.cropName = cropName;

    const variety = body.variety;
    if (variety !== undefined) data.variety = variety;

    const status = body.status;
    if (status !== undefined) data.status = status;

    const plantingDate = getDateVal('plantingDate', 'planting_date');
    if (plantingDate !== undefined) data.plantingDate = plantingDate;

    const expectedHarvestDate = getDateVal('expectedHarvestDate', 'expected_harvest_date');
    if (expectedHarvestDate !== undefined) data.expectedHarvestDate = expectedHarvestDate;

    const actualHarvestDate = getDateVal('actualHarvestDate', 'actual_harvest_date');
    if (actualHarvestDate !== undefined) data.actualHarvestDate = actualHarvestDate;

    const yieldKg = getVal('yieldKg', 'yield_kg');
    if (yieldKg !== undefined) data.yieldKg = yieldKg;

    const notes = body.notes;
    if (notes !== undefined) data.notes = notes;

    return data;
}

/**
 * PATCH /api/fields/:fieldId/cycles/:id — update crop cycle
 */
router.patch('/:fieldId/cycles/:id', async (req: Request, res: Response) => {
    try {
        const { fieldId, id } = req.params;
        if (!fieldId || !id) {
            return res.status(400).json({ success: false, error: 'fieldId and cycle id are required' });
        }
        const prisma = getPrisma();
        const data = mapCropCycleUpdate(req.body);

        const cycle = await prisma.cropCycle.update({
            where: { id },
            data,
        });
        return res.json({ success: true, data: cycle });
    } catch (error) {
        logger.error('Failed to update crop cycle:', error);
        return safeError(res, 500, 'Failed to update crop cycle');
    }
});

/**
 * GET /api/fields/stats/summary — aggregated counts + area by farmer.
 * Uses raw SQL because pg's ARRAY_AGG / SUM are clearer than the Prisma API here.
 */
router.get('/stats/summary', async (_req: Request, res: Response) => {
    try {
        const { rows } = await query<FieldStatsRow>(
            `SELECT farmer_id,
                    COUNT(*)          AS total_fields,
                    SUM(area_hectares) AS total_size,
                    ARRAY_AGG(DISTINCT soil_type) FILTER (WHERE soil_type IS NOT NULL) AS crop_types
               FROM fields
              WHERE is_active = true
              GROUP BY farmer_id`
        );

        const { rows: countRows } = await query<CountRow>(
            'SELECT COUNT(*) AS count FROM fields WHERE is_active = true'
        );

        const [totalCount] = countRows.map(mapCountRow);

        return res.json({
            success: true,
            data: {
                byFarmer: mapFieldStatsRows(rows),
                totalFields: totalCount?.count ?? 0,
            },
        });
    } catch (error) {
        logger.error('Failed to fetch field stats:', error);
        return safeError(res, 500, 'Failed to fetch field stats');
    }
});

export default router;
