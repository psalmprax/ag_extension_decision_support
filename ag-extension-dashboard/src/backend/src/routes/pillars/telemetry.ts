import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { calculateVpdKPa, evaluateSmartIrrigation } from '@/services/iotTelemetryService';
import { analyzeParcelMultispectral } from '@/services/satelliteNdviService';
import { ingestParcelBands, ingestStatus } from '@/services/satelliteIngestService';
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

const satelliteBboxSchema = z.object({
    minLat: z.number(), maxLat: z.number(), minLng: z.number(), maxLng: z.number(),
    fromDate: z.string(), toDate: z.string(), maxCloudCoverPct: z.number().optional(),
});

const satelliteAnalyzeSchema = z.object({
    parcelId: z.string().min(1),
    pixels: z.array(z.object({ bandRed: z.number(), bandNir: z.number(), bandGreen: z.number().optional(), bandSwir: z.number().optional() })).min(1).optional(),
    bbox: satelliteBboxSchema.optional(),
    cloudCoverPct: z.number().optional(), baselineNdvi: z.number().optional(),
}).refine(v => v.pixels || v.bbox, { message: 'Supply either pixels (caller bands) or bbox (Sentinel Hub ingest)' });

/**
 * Analyze a parcel. Callers may POST raw bands, or a bbox to ingest real Sentinel-2
 * imagery first. The ingest path fails loudly when SENTINEL_HUB_* is not configured
 * rather than analyzing assumed bands.
 */
router.post('/satellite/analyze', checkUsageLimit('ai_chat'), validate({ body: satelliteAnalyzeSchema }), async (req: AuthRequest, res: Response) => {
    try {
        const { parcelId, pixels, bbox, cloudCoverPct, baselineNdvi } = req.body as {
            parcelId: string;
            pixels?: Parameters<typeof analyzeParcelMultispectral>[0]['pixels'];
            bbox?: Parameters<typeof ingestParcelBands>[0];
            cloudCoverPct?: number;
            baselineNdvi?: number;
        };

        let bands = pixels;
        let effectiveCloudCover = cloudCoverPct;
        let ingestSource = 'caller_supplied_bands';

        if (!bands) {
            const ingest = await ingestParcelBands(bbox as Parameters<typeof ingestParcelBands>[0]);
            bands = ingest.pixels;
            effectiveCloudCover = effectiveCloudCover ?? ingest.cloudCoverPct;
            ingestSource = ingest.source;
        }

        const analysis = analyzeParcelMultispectral({ parcelId, pixels: bands, cloudCoverPct: effectiveCloudCover, baselineNdvi });
        return res.json({ success: true, data: { ...analysis, ingestSource } });
    } catch (e) {
        return safeError(res, 502, (e as Error).message);
    }
});

/** Report whether satellite ingest credentials are present (no imagery fetched). */
router.get('/satellite/ingest-status', checkUsageLimit('ai_chat'), async (_req: AuthRequest, res: Response) => {
    return res.json({ success: true, data: ingestStatus() });
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
