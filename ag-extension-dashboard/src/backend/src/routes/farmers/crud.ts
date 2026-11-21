import { Router, Request, Response } from 'express';
import { Farmer } from '@prisma/client';
import { logger } from '@/utils/logger';
import { validate } from '@/middleware/validationMiddleware';
import { createFarmerSchema, updateFarmerSchema } from '@/utils/schemas';
import { getPrisma } from '@/services/prismaService';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { safeError } from '@/utils/safeResponse';
import { demoWhere } from '@/services/demoScope';
import { farmerRecordFilter, validateRecordScope } from '@/services/demoRecordScope';
import { resolveCreationOfficer } from '@/services/farmerOfficerAssignment';
import { toE164 } from '@/services/country/phone';
import { farmerCountryFor } from '@/services/country/countryContext';
import { requireFarmerAccess } from '@/services/access/farmerScope';

const router = Router();

async function applyTenantScope(
    req: Request,
    where: Record<string, unknown>,
    allowTestFixture = false
): Promise<boolean> {
    const user = req.user;
    if (!user?.userId || !user.role) return false;
    // Demo farmers are only for the demo session; real accounts never see them.
    Object.assign(where, demoWhere(user));
    if (user.role === 'admin') return true;

    const tenantId = user.tenantId || await getPrincipalTenantId(user.userId);
    if (!tenantId) return process.env.NODE_ENV === 'test' && allowTestFixture;
    where.tenantId = tenantId;
    return true;
}

async function recordInitialAssignment(
    prisma: ReturnType<typeof getPrisma>,
    farmerId: string,
    assignedOfficerId: string | null,
    userId: string | undefined,
    userRole: string | undefined
): Promise<void> {
    // Audit assignment in FarmerAssignmentHistory
    if (assignedOfficerId && userId && typeof prisma.farmerAssignmentHistory?.create === 'function') {
        try {
            await prisma.farmerAssignmentHistory.create({
                data: {
                    farmerId,
                    officerId: assignedOfficerId,
                    reassignedBy: userId,
                    reason: userRole === 'extension_officer'
                        ? 'Auto-assigned upon registration by extension officer'
                        : 'Assigned upon creation',
                },
            });
        } catch (historyErr) {
            logger.warn('Failed to record farmer assignment history on creation:', historyErr);
        }
    }
}

/**
 * @openapi
 * /api/farmers:
 *   get:
 *     summary: Get all farmers
 *     tags: [Farmers]
 *     parameters:
 *       - in: query
 *         name: dataset
 *         schema:
 *           type: string
 *           enum: [live, demo]
 *           default: live
 *         description: Demo records are available only to non-demo administrators.
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
router.get('/', validateRecordScope, async (req: Request, res: Response) => {
    try {
        const { region: queryRegion, search, limit = '50', offset = '0', mobile = 'false' } = req.query;
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);
        const prisma = getPrisma();

        const where: Record<string, unknown> = {
            AND: [farmerRecordFilter(req.query.dataset === 'demo')],
        };
        if (!(await applyTenantScope(req, where, true))) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }
        if (req.query.dataset === 'demo') delete where.isDemo;

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
                    assignedOfficerId: f.assignedOfficerId || undefined,
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
                    assignedOfficerId: f.assignedOfficerId || undefined,
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
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);
        const prisma = getPrisma();

        const farmerWhere: Record<string, unknown> = { id };
        if (!(await applyTenantScope(req, farmerWhere, true))) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }
        const farmer = typeof prisma.farmer.findFirst === 'function'
            ? await prisma.farmer.findFirst({ where: farmerWhere })
            : await prisma.farmer.findUnique({ where: { id } });

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
                assignedOfficerId: farmer.assignedOfficerId || null,
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
        // Enrollment is staff work: a farmer account may read and update its own
        // record, but creating farmer records would let any farmer mint
        // unassigned records the extension team then has to reconcile.
        if (req.user?.role === 'farmer') {
            return res.status(403).json({
                success: false,
                error: 'Farmer accounts cannot create farmer records',
            });
        }

        const {
            firstName, lastName, phone: rawPhone, region, village,
            farmSize, crops, languagePreference,
            vitalScore, yieldHistory, locationLat, locationLng,
            assignedOfficerId: requestedOfficerId,
        } = req.body;
        const prisma = getPrisma();
        const country = await farmerCountryFor(req.body?.country, req.user?.userId);
        const phone = rawPhone ? toE164(String(rawPhone), country) : null;
        if (rawPhone && !phone) {
            return res.status(400).json({ success: false, error: `That phone number is not valid for ${country}.`, code: 'INVALID_PHONE' });
        }
        const tenantScope: Record<string, unknown> = {};
        if (!(await applyTenantScope(req, tenantScope, true))) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }

        const user = req.user as { userId?: string; role?: string } | undefined;
        const userRole = user?.role ? String(user.role) : undefined;
        const userId = user?.userId ? String(user.userId) : undefined;

        const assignment = await resolveCreationOfficer(prisma, { userId, role: userRole }, requestedOfficerId, region);
        if (!assignment.ok) {
            return res.status(assignment.status).json({ success: false, error: assignment.error, code: assignment.code });
        }
        const assignedOfficerId = assignment.officerId;

        const farmer = await prisma.farmer.create({
            data: {
                firstName,
                lastName,
                phone,
                country,
                region,
                village,
                farmSizeHectares: farmSize,
                crops,
                languagePreference: languagePreference || 'en',
                vitalScore,
                yieldHistory,
                locationLat,
                locationLng,
                tenantId: tenantScope.tenantId as string,
                assignedOfficerId,
                assignmentNotificationSent: Boolean(assignedOfficerId && userRole === 'extension_officer'),
            },
        });

        await recordInitialAssignment(prisma, farmer.id, assignedOfficerId, userId, userRole);

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
                assignedOfficerId: farmer.assignedOfficerId,
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
/** A new phone number for a farmer, read in the farmer's own country. */
async function normalisedFarmerPhone(prisma: ReturnType<typeof getPrisma>, farmerId: string, raw: string): Promise<{ phone: string } | { error: string }> {
    const existing = await prisma.farmer.findFirst({ where: { id: farmerId }, select: { country: true } });
    const phone = toE164(raw, existing?.country);
    return phone ? { phone } : { error: `That phone number is not valid for ${existing?.country ?? 'this country'}.` };
}

// The shared rule: an officer their assigned farmers, a manager their region, a farmer themselves.
router.patch('/:id', requireFarmerAccess('id'), validate(updateFarmerSchema), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as Request & { user?: Record<string, unknown> }).user;
        const tenantScope: Record<string, unknown> = {};
        if (!(await applyTenantScope(req, tenantScope))) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }

        const {
            firstName, lastName, phone: rawPhone, region, village,
            farmSize, crops, languagePreference,
            vitalScore, yieldHistory, locationLat, locationLng
        } = req.body;
        const prisma = getPrisma();
        const phoneCheck = rawPhone ? await normalisedFarmerPhone(prisma, id, String(rawPhone)) : null;
        if (phoneCheck && 'error' in phoneCheck) {
            return res.status(400).json({ success: false, error: phoneCheck.error, code: 'INVALID_PHONE' });
        }
        const phone = phoneCheck?.phone;

        const updateResult = await prisma.farmer.updateMany({
            where: { id, ...demoWhere(user), ...(tenantScope.tenantId ? { tenantId: tenantScope.tenantId as string } : {}) },
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

        if (updateResult.count === 0) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }
        const farmer = await prisma.farmer.findUnique({ where: { id } });
        if (!farmer) return res.status(404).json({ success: false, error: 'Farmer not found' });

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
                assignedOfficerId: farmer.assignedOfficerId,
            }
        });
    } catch (error) {
        logger.error('Update farmer error:', error);
        safeError(res, 500, 'Failed to update farmer');
    }
});

/**
 * @openapi
 * /api/farmers/my-officer:
 *   get:
 *     summary: Get the current farmer's assigned extension officer
 *     tags: [Farmers]
 *     responses:
 *       200:
 *         description: Officer profile
 *       403:
 *         description: Only farmers can access this endpoint
 *       404:
 *         description: No officer assigned
 */
router.get('/my-officer', async (req: Request, res: Response) => {
    try {
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
        const userId = String(_userId);
        const role = String(_role);
        const prisma = getPrisma();

        if (role !== 'farmer') {
            return res.status(403).json({ success: false, error: 'Only farmers can access this endpoint' });
        }

        const farmer = await prisma.farmer.findFirst({
            where: { userId },
            select: { id: true, assignedOfficerId: true },
        });

        if (!farmer) {
            return res.status(404).json({ success: false, error: 'Farmer profile not found' });
        }

        if (!farmer.assignedOfficerId) {
            return res.status(404).json({ success: false, error: 'No extension officer assigned' });
        }

        const officer = await prisma.user.findUnique({
            where: { id: farmer.assignedOfficerId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                region: true,
                role: true,
            },
        });

        if (!officer) {
            return res.status(404).json({ success: false, error: 'Assigned officer not found' });
        }

        res.json({
            success: true,
            data: {
                id: officer.id,
                firstName: officer.firstName,
                lastName: officer.lastName,
                email: officer.email,
                phone: officer.phone,
                region: officer.region,
                role: officer.role,
            },
        });
    } catch (error) {
        logger.error('Get my-officer error:', error);
        safeError(res, 500, 'Failed to get assigned officer');
    }
});

export default router;
