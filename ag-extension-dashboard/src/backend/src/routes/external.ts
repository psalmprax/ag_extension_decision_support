import { Router, Request, Response } from 'express';
import { WeatherService } from '@/services/weatherService';
import { FAOService } from '@/services/faoService';
import { priorityService } from '@/services/priorityService';
import { getPrisma } from '@/services/prismaService';
import { logger } from '@/utils/logger';
import { getMapData } from '@/services/mapService';
import { marketPriceService } from '@/services/marketPriceService';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { soilDataQuerySchema } from '@/utils/schemas';
import { SatelliteService } from '@/services/satelliteService';
import { UsdaMarketService } from '@/services/usdaMarketService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all external routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Get priority score for a farmer — access-controlled
router.get('/priority/:farmerId', async (req: Request, res: Response) => {
    try {
        const { farmerId } = req.params;
        const user = req.user as { userId?: string; role?: string } | undefined;
        const prisma = getPrisma();

        // Verify the requesting user has access to this farmer
        const farmer = await prisma.farmer.findUnique({
            where: { id: farmerId },
            select: { userId: true, assignedOfficerId: true },
        });
        if (!farmer) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }
        if (user?.role === 'farmer' && farmer.userId !== user.userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        if (user?.role === 'extension_officer' && farmer.assignedOfficerId !== user.userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

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

// Get vegetation (NDVI proxy) time series — NASA POWER agroclimatology
router.get('/ndvi-timeseries', validate(soilDataQuerySchema), async (req: Request, res: Response) => {
    try {
        const lat = parseFloat(req.query.lat as string);
        const lng = parseFloat(req.query.lng as string);
        const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 90, 7), 365);
        const series = await SatelliteService.getNDVITimeSeries(lat, lng, days);
        res.json({ success: true, data: series });
    } catch (error) {
        logger.error('NDVI time series route error:', error);
        safeError(res, 500, 'Failed to fetch vegetation time series');
    }
});

// Get USDA FAS PSD global commodity benchmarks
router.get('/usda/:crop', async (req: Request, res: Response) => {
    try {
        const crop = (req.params.crop || '').substring(0, 60);
        const country = (req.query.country as string || 'Kenya').substring(0, 60);
        const [countryData, worldBenchmark] = await Promise.all([
            UsdaMarketService.getCommodityData(country, crop),
            UsdaMarketService.getWorldBenchmark(crop),
        ]);
        const countryMetrics = UsdaMarketService.extractMetrics(countryData);
        const worldMetrics = UsdaMarketService.extractMetrics(worldBenchmark);
        res.json({
            success: true,
            data: {
                country: countryData.length > 0 ? { records: countryData, metrics: countryMetrics } : null,
                world: worldBenchmark.length > 0 ? { records: worldBenchmark, metrics: worldMetrics } : null,
                dataStatus: countryData.length > 0 || worldBenchmark.length > 0 ? 'live' : 'unavailable',
            },
        });
    } catch (error) {
        logger.error('USDA route error:', error);
        safeError(res, 500, 'Failed to fetch USDA commodity benchmarks');
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

router.get('/prices', async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const prices = await marketPriceService.getLatestPrices(userId);
        const firstPrice = prices[0];
        res.json({
            success: true,
            data: prices,
            metadata: {
                dataStatus: firstPrice?.dataStatus || 'unavailable',
                source: firstPrice?.source || null,
                fetchedAt: firstPrice?.fetchedAt || null,
                exchangeRateSource: firstPrice?.exchangeRateSource || null,
            },
        });
    } catch (error) {
        logger.error('Prices route error:', error);
        safeError(res, 500, 'Failed to fetch market prices');
    }
});

export default router;
