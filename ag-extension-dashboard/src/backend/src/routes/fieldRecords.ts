import { Router, Request, Response, NextFunction } from 'express';
import { authorize } from '@/middleware/authorize';
import { getPrisma } from '@/services/prismaService';
import { requestCanSeeFarmer } from '@/services/access/farmerScope';
import { soilLabService } from '@/services/soilLabService';
import { fieldWeather } from '@/services/fields/fieldWeather';
import { satelliteRecord } from '@/services/deafrica/satelliteFacts';
import { soilTestInputSchema } from '@/shared-api/fieldRecords';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { isUuid } from '@/utils/uuid';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';

/**
 * Records kept for one field: soil test results, daily NASA POWER weather and the Digital Earth
 * Africa satellite record. Anyone who may
 * see the field's farmer may read them; demo sessions may not change them.
 */
const router = Router();

// Per route, not router.use: this router shares /fields with the main fields router, and
// requests it does not handle should reach that one without being authorised twice.
const fieldUsers = [authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), requirePaidPlan('fields')];

function rejectDemoChanges(req: Request, res: Response, next: NextFunction) {
    if (req.user?.isDemo) {
        return res.status(403).json({ success: false, error: 'Demo fields are read-only; changes are not saved.' });
    }
    next();
}

interface VisibleField {
    id: string;
    farmerId: string;
    latitude: number | null;
    longitude: number | null;
}

/** The field in the URL when it exists, is in use and its farmer is visible to the caller. */
async function visibleField(req: Request, res: Response): Promise<VisibleField | null> {
    const fieldId = req.params.fieldId;
    const field = isUuid(fieldId)
        ? await getPrisma().field.findUnique({
              where: { id: fieldId },
              select: { id: true, farmerId: true, isActive: true, latitude: true, longitude: true },
          })
        : null;
    if (!field || field.isActive === false || !(await requestCanSeeFarmer(req, field.farmerId))) {
        res.status(404).json({ success: false, error: 'Field not found' });
        return null;
    }
    return {
        id: field.id,
        farmerId: field.farmerId,
        latitude: field.latitude === null ? null : Number(field.latitude),
        longitude: field.longitude === null ? null : Number(field.longitude),
    };
}

router.get('/:fieldId/soil-tests', fieldUsers, async (req: Request, res: Response) => {
    try {
        const field = await visibleField(req, res);
        if (!field) return;
        return res.json({ success: true, data: await soilLabService.listForField(field.id) });
    } catch (error) {
        logger.error('Failed to list soil tests:', error);
        return safeError(res, 500, 'Failed to load soil tests');
    }
});

router.post('/:fieldId/soil-tests', fieldUsers, rejectDemoChanges, async (req: Request, res: Response) => {
    try {
        const parsed = soilTestInputSchema.safeParse(req.body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return res.status(400).json({ success: false, error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid soil test' });
        }
        const field = await visibleField(req, res);
        if (!field) return;
        const saved = await soilLabService.addForField(field, parsed.data);
        if (!saved) return res.status(409).json({ success: false, error: 'Another record already uses this id' });
        return res.status(201).json({ success: true, data: saved });
    } catch (error) {
        logger.error('Failed to save soil test:', error);
        return safeError(res, 500, 'Failed to save soil test');
    }
});

router.delete('/:fieldId/soil-tests/:testId', fieldUsers, rejectDemoChanges, async (req: Request, res: Response) => {
    try {
        const field = await visibleField(req, res);
        if (!field) return;
        const removed = isUuid(req.params.testId) && (await soilLabService.removeFromField(field.id, req.params.testId));
        if (!removed) return res.status(404).json({ success: false, error: 'Soil test not found' });
        return res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete soil test:', error);
        return safeError(res, 500, 'Failed to delete soil test');
    }
});

router.get('/:fieldId/weather', fieldUsers, async (req: Request, res: Response) => {
    try {
        const field = await visibleField(req, res);
        if (!field) return;
        if (field.latitude === null || field.longitude === null) {
            return res.status(409).json({ success: false, error: 'This field has no location yet. Add its coordinates or map its boundary.' });
        }
        const weather = await fieldWeather(field.latitude, field.longitude);
        if (!weather) {
            return res.status(503).json({ success: false, error: 'NASA POWER could not be reached. Try again later.' });
        }
        return res.json({ success: true, data: weather });
    } catch (error) {
        logger.error('Failed to load field weather:', error);
        return safeError(res, 500, 'Failed to load field weather');
    }
});

// What Digital Earth Africa says about the field: rain, greenness, cropland, WorldCereal, flood history
router.get('/:fieldId/satellite', fieldUsers, async (req: Request, res: Response) => {
    try {
        const field = await visibleField(req, res);
        if (!field) return;
        if (field.latitude === null || field.longitude === null) {
            return res.status(409).json({ success: false, error: 'This field has no location yet. Add its coordinates or map its boundary.' });
        }
        const record = await satelliteRecord(field.latitude, field.longitude);
        if (Object.values(record).every(part => part === null)) {
            return res.status(503).json({ success: false, error: 'Digital Earth Africa could not be reached or has no data here. Try again later.' });
        }
        return res.json({ success: true, data: record });
    } catch (error) {
        logger.error('Failed to load field satellite record:', error);
        return safeError(res, 500, 'Failed to load the satellite record');
    }
});

export default router;
