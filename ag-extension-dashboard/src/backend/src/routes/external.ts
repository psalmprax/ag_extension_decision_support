import { Router, Request, Response } from 'express';
import { WeatherService } from '@/services/weatherService';
import { FAOService } from '@/services/faoService';
import { logger } from '@/utils/logger';
import { getMapData } from '@/services/mapService';
import { authorize } from '@/middleware/authorize';

const router = Router();

// Apply authentication to all external routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

// Get weather by location
router.get('/weather', async (req: Request, res: Response) => {
    try {
        const location = req.query.location as string || 'Kenya';
        const weather = await WeatherService.getByLocation(location);
        res.json({ success: true, data: weather });
    } catch (error) {
        logger.error('Weather route error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch weather' });
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
        res.status(500).json({ success: false, error: 'Failed to fetch disease alerts' });
    }
});

router.get('/map', async (_req: Request, res: Response) => {
    try {
        const mapData = await getMapData();
        res.json({ success: true, data: mapData });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch map data' });
    }
});

export default router;
