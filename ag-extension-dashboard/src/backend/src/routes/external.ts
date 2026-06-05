import { Router, Request, Response } from 'express';
import { WeatherService } from '@/services/weatherService';
import { FAOService } from '@/services/faoService';
import { priorityService } from '@/services/priorityService';
import { logger } from '@/utils/logger';
import { getMapData } from '@/services/mapService';
import { marketPriceService } from '@/services/marketPriceService';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { soilDataQuerySchema, weatherQuerySchema } from '@/utils/schemas';
import { SatelliteService } from '@/services/satelliteService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all external routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Get priority score for a farmer
router.get('/priority/:farmerId', async (req: Request, res: Response) => {
    try {
        const { farmerId } = req.params;
        const priority = await priorityService.calculateUrgencyScore(farmerId);
        res.json({ success: true, data: priority });
    } catch (error) {
        logger.error(`Priority route error for farmer ${req.params.farmerId}:`, error);
        safeError(res, 500, 'Failed to calculate priority score');
    }
});

// Get satellite telemetry (spectral indices)
router.get('/satellite', validate(soilDataQuerySchema), async (req: Request, res: Response) => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);
        
        const indices = await SatelliteService.getSpectralIndices(lat, lng);
        res.json({ success: true, data: indices });
    } catch (error) {
        logger.error('Satellite route error:', error);
        safeError(res, 500, 'Failed to fetch satellite telemetry');
    }
});

// Get weather by location
router.get('/weather/:location?', async (req: Request, res: Response) => {
    try {
        const rawLocation = req.params.location || req.query.location as string || 'Kenya';
        const location = rawLocation.substring(0, 200).replace(/[<>"'`;${}()|&]/g, '').trim() || 'Kenya';
        const weather = await WeatherService.getByLocation(location);
        res.json({ success: true, data: weather });
    } catch (error) {
        logger.error('Weather route error:', (error as Error).message);
        safeError(res, 500, 'Failed to fetch weather');
    }
});

// Get disease alerts
router.get('/alerts', async (req: Request, res: Response) => {
    try {
        const region = req.query.region as string || 'Kenya';
        const crop = req.query.crop as string;
        const alerts = await FAOService.getDiseaseAlerts(region, crop);
        res.json({ success: true, data: alerts });
    } catch (error) {
        logger.error('Alerts route error:', error);
        safeError(res, 500, 'Failed to fetch disease alerts');
    }
});

router.get('/map', async (_req: Request, res: Response) => {
    try {
        const mapData = await getMapData();
        res.json({ success: true, data: mapData });
    } catch (error) {
        safeError(res, 500, 'Failed to fetch map data');
    }
});

router.get('/prices', async (_req: Request, res: Response) => {
    try {
        const prices = await marketPriceService.getLatestPrices();
        res.json({ success: true, data: prices });
    } catch (error) {
        logger.error('Prices route error:', error);
        safeError(res, 500, 'Failed to fetch market prices');
    }
});

export default router;
