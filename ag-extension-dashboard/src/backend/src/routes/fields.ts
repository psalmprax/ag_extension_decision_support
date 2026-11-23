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
import { demoWhere, linkedDemoSql } from '@/services/demoScope';
import { canSeeFarmer, requestCanSeeFarmer, rowsOfVisibleFarmersSql, visibleFarmerIds } from '@/services/access/farmerScope';
import { createFieldSchema, updateFieldSchema } from '@/shared-api/field';
import { fieldColumnsFromWrite } from '@/services/fields/fieldWrite';

const router = Router();

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));
router.use((req: Request, res: Response, next) => {
    if (req.user?.isDemo && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        logger.warn('Demo field mutation rejected', { method: req.method });
        return res.status(403).json({ success: false, error: 'Demo fields are read-only; changes are not saved.' });
    }
    next();
});

interface FieldUser {
    userId?: string;
    role?: string;
    isDemo?: boolean;
}

async function checkFieldCreationAccess(
    prisma: ReturnType<typeof getPrisma>,
    user: FieldUser | undefined,
    farmerId: string
): Promise<{ status: number; error: string } | null> {
    if (user?.role === 'farmer') {
        const farmer = await prisma.farmer.findFirst({ where: { userId: user.userId } });
        if (!farmer) {
            return { status: 403, error: 'Access denied' };
        }
        if (farmerId !== farmer.id) {
            return { status: 403, error: 'Field must belong to your farm' };
        }
    } else if (user?.role === 'extension_officer') {
        const assigned = await prisma.farmer.findFirst({
            where: { id: farmerId, assignedOfficerId: user.userId },
            select: { id: true },
        });
        if (!assigned) {
            return { status: 403, error: 'Access denied: farmer not assigned to officer' };
        }
    } else if (user?.role === 'admin' || user?.role === 'regional_manager') {
        // A manager only adds fields for farmers in their region; an admin for anyone.
        const visible = user.userId && (await canSeeFarmer({ userId: user.userId, role: user.role }, farmerId));
        if (!visible) {
            return { status: 404, error: 'Farmer not found' };
        }
    } else {
        return { status: 403, error: 'Access denied' };
    }
    return null;
}

function parseCropCycleDate(camel?: string, snake?: string): Date | null {
    const value = camel || snake;
    return value ? new Date(value) : null;
}

async function buildFieldListWhere(
    user: FieldUser | undefined,
    farmerIdQuery: unknown
): Promise<Prisma.FieldWhereInput> {
    // Demo farmers' fields are only for the demo session.
    const where: Prisma.FieldWhereInput = { isActive: true, farmer: demoWhere(user) };
    const farmerId = typeof farmerIdQuery === 'string' ? farmerIdQuery : undefined;
    if (!user?.userId || !user.role) return { ...where, farmerId: { in: [] } };
    // Only the fields of farmers this person may see (the shared access rule).
    const visible = await visibleFarmerIds({ userId: user.userId, role: user.role, isDemo: user.isDemo });
    if (farmerId) where.farmerId = visible === null || visible.includes(farmerId) ? farmerId : { in: [] };
    else if (visible !== null) where.farmerId = { in: visible };
    return where;
}

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
        const user = req.user as FieldUser | undefined;

        // Reject malformed farmerId early (validates both UUID shape and length)
        if (farmerId && !UUID_REGEX.test(String(farmerId))) {
            return res.json({ success: true, data: [], total: 0 });
        }

        // Farmer role: enforce auto-assignment to self
        if (user?.role === 'farmer') {
            const farmer = await prisma.farmer.findFirst({ where: { userId: user.userId } });
            if (!farmer) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            if (farmerId && farmerId !== farmer.id) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        }

        // Officer: if a specific farmerId is requested, validate they own that assignment
        if (user?.role === 'extension_officer' && farmerId) {
            const assigned = await prisma.farmer.findFirst({
                where: { id: farmerId as string, assignedOfficerId: user.userId },
                select: { id: true },
            });
            if (!assigned) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
        }

        const where = await buildFieldListWhere(user, farmerId);

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
        const field = await prisma.field.findUnique({
            where: { id },
            include: { farmer: { select: { userId: true, assignedOfficerId: true } } },
        });
        // The shared access rule: own farm, assigned farmers, a manager's region, or everyone (admin).
        if (!field || !(await requestCanSeeFarmer(req, field.farmerId))) {
            return res.status(404).json({ success: false, error: 'Field not found' });
        }
        return res.json({ success: true, data: field });
    } catch (error) {
        logger.error('Failed to fetch field:', error);
        return safeError(res, 500, 'Failed to fetch field');
    }
});

/** The farmer a new field belongs to: the one named, or a farmer's own farm when none is named. */
async function resolveNewFieldFarmer(prisma: ReturnType<typeof getPrisma>, user: FieldUser | undefined, farmerId: string | undefined): Promise<string | null> {
    if (farmerId) return farmerId;
    if (user?.role !== 'farmer') return null;
    const own = await prisma.farmer.findFirst({ where: { userId: user.userId }, select: { id: true } });
    return own?.id ?? null;
}

function invalidBody(res: Response, issues: { path: PropertyKey[]; message: string }[]) {
    const first = issues[0];
    return res.status(400).json({ success: false, error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid field' });
}

/**
 * POST /api/fields — create a field. With a boundary, the area and location are measured from it.
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const parsed = createFieldSchema.safeParse(req.body);
        if (!parsed.success) return invalidBody(res, parsed.error.issues);
        const prisma = getPrisma();
        const user = req.user as FieldUser | undefined;
        const farmerId = await resolveNewFieldFarmer(prisma, user, parsed.data.farmerId);
        if (!farmerId) {
            return res.status(400).json({ success: false, error: 'farmerId is required' });
        }

        const accessError = await checkFieldCreationAccess(prisma, user, farmerId);
        if (accessError) {
            return res.status(accessError.status).json({ success: false, error: accessError.error });
        }
        const columns = fieldColumnsFromWrite(parsed.data);
        if (!columns.ok) return res.status(400).json({ success: false, error: columns.error });
        const field = await prisma.field.create({
            data: {
                soilType: null,
                soilPh: null,
                ...(columns.data as Prisma.FieldUncheckedCreateInput),
                farmerId,
                name: parsed.data.name,
                areaHectares: columns.data.areaHectares as number,
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
 * PUT /api/fields/:id — update a field. While it has a boundary, its area and location follow it.
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Field id is required' });
        }
        const parsed = updateFieldSchema.safeParse(req.body);
        if (!parsed.success) return invalidBody(res, parsed.error.issues);
        const prisma = getPrisma();
        const foundField = await prisma.field.findUnique({
            where: { id },
            select: { farmerId: true, boundaryCoordinates: true },
        });
        if (!foundField || !(await requestCanSeeFarmer(req, foundField.farmerId))) {
            return res.status(404).json({ success: false, error: 'Field not found' });
        }

        const columns = fieldColumnsFromWrite(parsed.data, foundField.boundaryCoordinates != null);
        if (!columns.ok) return res.status(400).json({ success: false, error: columns.error });
        const field = await prisma.field.update({ where: { id }, data: columns.data });
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
        const field = await prisma.field.findUnique({ where: { id }, select: { farmerId: true } });
        if (!field || !(await requestCanSeeFarmer(req, field.farmerId))) {
            return res.status(404).json({ success: false, error: 'Field not found' });
        }
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
        const plantingDate = parseCropCycleDate(body.plantingDate, body.planting_date);
        const expectedHarvestDate = parseCropCycleDate(body.expectedHarvestDate, body.expected_harvest_date);

        if (!cropName) {
            return res.status(400).json({ success: false, error: 'cropName is required' });
        }

        const prisma = getPrisma();
        const field = await prisma.field.findUnique({ where: { id: fieldId }, select: { farmerId: true } });
        if (!field || !(await requestCanSeeFarmer(req, field.farmerId))) {
            return res.status(404).json({ success: false, error: 'Field not found' });
        }
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

type CropCycleUpdateBody = Partial<{
    cropName: string;
    crop_name: string;
    variety: string | null;
    status: string;
    plantingDate: string | null;
    planting_date: string | null;
    expectedHarvestDate: string | null;
    expected_harvest_date: string | null;
    actualHarvestDate: string | null;
    actual_harvest_date: string | null;
    yieldKg: number | null;
    yield_kg: number | null;
    notes: string | null;
}>;

function mapCropCycleUpdate(body: CropCycleUpdateBody): Prisma.CropCycleUpdateInput {
    const data: Record<string, Date | null | undefined> = {};
    applyFieldIfDefined(data, 'cropName', getVal(body, 'cropName', 'crop_name'));
    applyFieldIfDefined(data, 'variety', body.variety);
    applyFieldIfDefined(data, 'status', body.status);
    applyDateFieldIfDefined(data, 'plantingDate', getDateVal(body, 'plantingDate', 'planting_date'));
    applyDateFieldIfDefined(data, 'expectedHarvestDate', getDateVal(body, 'expectedHarvestDate', 'expected_harvest_date'));
    applyDateFieldIfDefined(data, 'actualHarvestDate', getDateVal(body, 'actualHarvestDate', 'actual_harvest_date'));
    applyFieldIfDefined(data, 'yieldKg', getVal(body, 'yieldKg', 'yield_kg'));
    applyFieldIfDefined(data, 'notes', body.notes);
    return data as Prisma.CropCycleUpdateInput;
}

function getVal<K extends keyof CropCycleUpdateBody>(body: CropCycleUpdateBody, camel: K, snake: K): CropCycleUpdateBody[K] {
    return body[camel] !== undefined ? body[camel] : body[snake];
}

function getDateVal(body: CropCycleUpdateBody, camel: keyof CropCycleUpdateBody, snake: keyof CropCycleUpdateBody): Date | null | undefined {
    const val = getVal(body, camel, snake);
    return typeof val === 'string' && val ? new Date(val) : (val === null ? null : undefined);
}

function applyFieldIfDefined(
    data: Prisma.CropCycleUpdateInput,
    key: 'cropName' | 'variety' | 'status' | 'yieldKg' | 'notes',
    value: string | number | null | undefined
): void {
    if (value === undefined) return;
    switch (key) {
        case 'cropName': if (typeof value === 'string') data.cropName = value; break;
        case 'variety': if (typeof value === 'string' || value === null) data.variety = value; break;
        case 'status': if (typeof value === 'string') data.status = value; break;
        case 'yieldKg': if (typeof value === 'number' || value === null) data.yieldKg = value; break;
        case 'notes': if (typeof value === 'string' || value === null) data.notes = value; break;
    }
}

function applyDateFieldIfDefined(
    data: Prisma.CropCycleUpdateInput,
    key: 'plantingDate' | 'expectedHarvestDate' | 'actualHarvestDate',
    value: Date | null | undefined
): void {
    if (value === undefined) return;
    if (key === 'plantingDate') data.plantingDate = value;
    if (key === 'expectedHarvestDate') data.expectedHarvestDate = value;
    if (key === 'actualHarvestDate') data.actualHarvestDate = value;
}

/**
 * PATCH /api/fields/:fieldId/cycles/:id — update crop cycle
 */
type CycleAccess = { ok: true; id: string } | { ok: false; status: number; error: string };

/** The crop cycle in the URL, if it exists on that field and the caller may change it. */
async function resolveEditableCycle(req: Request): Promise<CycleAccess> {
    const { fieldId, id } = req.params;
    if (!fieldId || !id) return { ok: false, status: 400, error: 'fieldId and cycle id are required' };
    const existingCycle = await getPrisma().cropCycle.findUnique({
        where: { id },
        select: { fieldId: true, field: { select: { farmerId: true } } },
    });
    if (!existingCycle || existingCycle.fieldId !== fieldId || !(await requestCanSeeFarmer(req, existingCycle.field?.farmerId))) {
        return { ok: false, status: 404, error: 'Crop cycle not found' };
    }
    return { ok: true, id };
}

router.patch('/:fieldId/cycles/:id', async (req: Request, res: Response) => {
    try {
        const access = await resolveEditableCycle(req);
        if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

        const data = mapCropCycleUpdate(req.body as CropCycleUpdateBody);
        const cycle = await getPrisma().cropCycle.update({ where: { id: access.id }, data });
        return res.json({ success: true, data: cycle });
    } catch (error) {
        logger.error('Failed to update crop cycle:', error);
        return safeError(res, 500, 'Failed to update crop cycle');
    }
});

/** DELETE /api/fields/:fieldId/cycles/:id — same access rules as editing the cycle. */
router.delete('/:fieldId/cycles/:id', async (req: Request, res: Response) => {
    try {
        const access = await resolveEditableCycle(req);
        if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

        await getPrisma().cropCycle.delete({ where: { id: access.id } });
        return res.json({ success: true, data: { id: access.id } });
    } catch (error) {
        if ((error as { code?: string })?.code === 'P2003') {
            return res.status(409).json({ success: false, error: 'This crop cycle has records that depend on it and cannot be deleted.' });
        }
        logger.error('Failed to delete crop cycle:', error);
        return safeError(res, 500, 'Failed to delete crop cycle');
    }
});

/**
 * GET /api/fields/stats/summary — aggregated counts + area by farmer.
 * Uses raw SQL because pg's ARRAY_AGG / SUM are clearer than the Prisma API here.
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
    try {
        const user = req.user as { userId?: string; role?: string; isDemo?: boolean } | undefined;
        if (!user?.userId || !user.role) return res.status(401).json({ success: false, error: 'Authentication required' });
        // Only fields of farmers this person may see (the shared access rule).
        const scope = await rowsOfVisibleFarmersSql({ userId: user.userId, role: user.role, isDemo: user.isDemo }, 'fields.farmer_id');
        const scopeClause = ` AND ${scope.sql}`;
        const scopeParams = scope.params;

        const { rows } = await query<FieldStatsRow>(
            `SELECT farmer_id,
                    COUNT(*)          AS total_fields,
                    SUM(area_hectares) AS total_size,
                    ARRAY_AGG(DISTINCT soil_type) FILTER (WHERE soil_type IS NOT NULL) AS crop_types
               FROM fields
              WHERE is_active = true AND ${linkedDemoSql('fields', user)}${scopeClause}
              GROUP BY farmer_id`,
            scopeParams
        );

        const { rows: countRows } = await query<CountRow>(
            `SELECT COUNT(*) AS count FROM fields WHERE is_active = true${scopeClause}`,
            scopeParams
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
