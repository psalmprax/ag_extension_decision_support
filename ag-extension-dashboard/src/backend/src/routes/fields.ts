import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getPrisma } from '@/services/prismaService';
import { query } from '@/services/databaseService';
import type { CountRow, FieldStatsRow } from '@/types/rowTypes';
import { mapFieldStatsRows, mapCountRow } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

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
        if (farmerId) where.farmerId = farmerId as string;
        if (user?.role === 'farmer') where.farmerId = user.userId;

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
            name?: string;
            area_hectares?: number;
            soil_type?: string;
            soil_ph?: number;
            boundary_coordinates?: Prisma.JsonValue;
        };
        if (!body.farmer_id || !body.name || typeof body.area_hectares !== 'number') {
            return res.status(400).json({ success: false, error: 'farmer_id, name, and area_hectares are required' });
        }
        const prisma = getPrisma();
        const field = await prisma.field.create({
            data: {
                farmerId: body.farmer_id,
                name: body.name,
                areaHectares: body.area_hectares,
                soilType: body.soil_type ?? null,
                soilPh: body.soil_ph ?? null,
                boundaryCoordinates: (body.boundary_coordinates ?? null) as Prisma.InputJsonValue,
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
            area_hectares: number;
            soil_type: string;
            soil_ph: number;
            boundary_coordinates: Prisma.JsonValue;
        }>;

        const prisma = getPrisma();
        const data: Prisma.FieldUpdateInput = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.area_hectares !== undefined) data.areaHectares = body.area_hectares;
        if (body.soil_type !== undefined) data.soilType = body.soil_type;
        if (body.soil_ph !== undefined) data.soilPh = body.soil_ph;
        if (body.boundary_coordinates !== undefined) data.boundaryCoordinates = body.boundary_coordinates as Prisma.InputJsonValue;

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
