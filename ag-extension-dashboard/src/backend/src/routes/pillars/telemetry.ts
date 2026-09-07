import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { calculateVpdKPa, evaluateSmartIrrigation } from '@/services/iotTelemetryService';
import { analyzeParcelMultispectral } from '@/services/satelliteNdviService';
import { calculateSocStock, auditSoilCarbonSequestration } from '@/services/soilCarbonMrvService';
import { calculateAgronomicRoi } from '@/services/agronomicRoiService';
import { evaluateWeatherHazardsWithProvenance, runProactiveHazardScan } from '@/services/weatherHazardDaemonService';

const router = Router();

router.post('/iot/evaluate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    soilProbe: z.object({ vwcPct: z.number(), ecDsM: z.number(), soilTempC: z.number() }).optional(),
    weather: z.object({ tempC: z.number(), rhPct: z.number() }).optional(),
})}), async (req: AuthRequest, res: Response) => {
    try {
        const { soilProbe, weather } = req.body as { soilProbe?: Parameters<typeof evaluateSmartIrrigation>[0]; weather?: { tempC: number; rhPct: number } };
        const vpd = weather ? calculateVpdKPa(weather.tempC, weather.rhPct) : null;
        const irrigation = soilProbe ? evaluateSmartIrrigation(soilProbe as never) : null;
        return res.json({ success: true, data: { vpdKPa: vpd, irrigation } });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/satellite/analyze', checkUsageLimit('ai_chat'), validate({ body: z.object({
    parcelId: z.string().min(1), pixels: z.array(z.object({ bandRed: z.number(), bandNir: z.number(), bandGreen: z.number().optional(), bandSwir: z.number().optional() })).min(1),
    cloudCoverPct: z.number().optional(), baselineNdvi: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: analyzeParcelMultispectral(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/soil/carbon-stock', checkUsageLimit('ai_chat'), validate({ body: z.object({
    sample: z.object({ sampleId: z.string(), depthCm: z.number(), bulkDensityGPerCm3: z.number(), organicMatterPct: z.number(), coarseFragmentFraction: z.number(), testedAt: z.string() }),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: { socStockTCPerHa: calculateSocStock(req.body.sample as never) } }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/soil/carbon-audit', checkUsageLimit('ai_chat'), validate({ body: z.object({
    baselineSample: z.object({ sampleId: z.string(), depthCm: z.number(), bulkDensityGPerCm3: z.number(), organicMatterPct: z.number(), coarseFragmentFraction: z.number(), testedAt: z.string() }),
    currentSample: z.object({ sampleId: z.string(), depthCm: z.number(), bulkDensityGPerCm3: z.number(), organicMatterPct: z.number(), coarseFragmentFraction: z.number(), testedAt: z.string() }),
    hectares: z.number().positive(), carbonCreditPriceUsd: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: auditSoilCarbonSequestration(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/roi/calculate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    crop: z.string().min(1), hectares: z.number().optional(), commodityPricePerTonKes: z.number().optional(),
    controlYieldTons: z.number().optional(), advisoryYieldTons: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: calculateAgronomicRoi(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/hazard/evaluate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    forecast: z.array(z.object({ date: z.string(), minTempC: z.number(), maxTempC: z.number(), precipitationMm: z.number(), relativeHumidityPct: z.number(), windSpeedKmh: z.number() })),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: evaluateWeatherHazardsWithProvenance(req.body.forecast as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

router.post('/hazard/scan', checkUsageLimit('ai_chat'), validate({ body: z.object({
    county: z.string().min(1), forecast: z.array(z.object({ date: z.string(), minTempC: z.number(), maxTempC: z.number(), precipitationMm: z.number(), relativeHumidityPct: z.number(), windSpeedKmh: z.number() })), farmerCount: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await runProactiveHazardScan(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
