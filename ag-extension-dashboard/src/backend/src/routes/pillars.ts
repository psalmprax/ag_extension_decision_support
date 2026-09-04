import { Router, Response } from 'express';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { checkUsageLimit } from '@/middleware/usageMiddleware';

import { verifyEudrDeforestationCompliance, generateFarmToForkPassport } from '@/services/traceabilityPassportService';
import { computeAgronomicCreditScore, evaluateParametricInsuranceClaim } from '@/services/agriCreditInsuranceService';
import { clusterPestSightings, forecastSwarmTrajectory } from '@/services/pestSwarmRadarService';
import { findCrossBorderArbitrage } from '@/services/crossBorderTradeService';
import { findAvailableEquipment, planDroneSprayMission } from '@/services/mechanizationFleetService';
import { findNearbySuppliersLive, verifyBatchNumber } from '@/services/inputSupplierService';
import { aggregateHarvestProjections, matchOfftakerContracts } from '@/services/harvestOfftakeService';
import { calculateVpdKPa, evaluateSmartIrrigation } from '@/services/iotTelemetryService';
import { analyzeParcelMultispectral } from '@/services/satelliteNdviService';
import { calculateSocStock, auditSoilCarbonSequestration } from '@/services/soilCarbonMrvService';
import { calculateAgronomicRoi } from '@/services/agronomicRoiService';
import { evaluateWeatherHazardsWithProvenance, runProactiveHazardScan } from '@/services/weatherHazardDaemonService';
import { transcribeVoiceNote, synthesizeVoiceAdvisory } from '@/services/voiceAudioService';
import { generateIvrXml, processDtmfResponse, dispatchVoiceBroadcast } from '@/services/ivrBroadcastService';
import { getTenantBySlug, validateTenantAdvisoryCompliance } from '@/services/multiTenantFederationService';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

/**
 * Specification-phase gate.
 *
 * Most services behind this router are @deprecated prototypes (see
 * docs/PILLAR_SERVICES_DECISION.md): they compute from hardcoded registries and
 * illustrative constants. Only the endpoints the product actually uses are always
 * on; everything else returns 501 unless PILLARS_SPEC_ROUTES_ENABLED=true is set
 * for a sandbox/demo deployment. Responses from gated routes are stamped
 * `dataStatus: 'specification_prototype'` so nothing downstream mistakes them for
 * verified data.
 */
const PRODUCTION_PILLAR_ROUTES = new Set<string>([
    'POST /hazard/evaluate',
    'POST /voice/transcribe',
    'POST /voice/transcribe-local',
]);

router.use((req: AuthRequest, res: Response, next) => {
    const key = `${req.method} ${req.path}`;
    if (PRODUCTION_PILLAR_ROUTES.has(key)) return next();
    if (process.env.PILLARS_SPEC_ROUTES_ENABLED === 'true') {
        // Stamp prototype provenance onto every JSON body from a gated route.
        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            if (body && typeof body === 'object' && !Array.isArray(body)) {
                return originalJson({ ...(body as Record<string, unknown>), dataStatus: 'specification_prototype' });
            }
            return originalJson(body);
        };
        return next();
    }
    return res.status(501).json({
        success: false,
        errorCode: 'PILLAR_NOT_IMPLEMENTED',
        error: 'This capability is a specification-phase prototype and is not enabled in this deployment.',
        route: key,
    });
});

// ── Traceability ───────────────────────────────────────────────────────────
router.post('/traceability/eudr-verify', checkUsageLimit('ai_chat'), validate({ body: z.object({
    parcelId: z.string().min(1), country: z.string().min(1), commodity: z.enum(['coffee','cocoa','tea','soy','avocado']),
    centroid: z.tuple([z.number(), z.number()]), polygonVertexCount: z.number().int().min(3),
    forestCanopyBaseline2020Pct: z.number().min(0).max(100).optional(), currentForestCanopyPct: z.number().min(0).max(100).optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: verifyEudrDeforestationCompliance(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/traceability/passport', checkUsageLimit('ai_chat'), validate({ body: z.object({
    batchId: z.string().min(1), commodityName: z.string().min(1), tonnage: z.number().positive(), originCooperative: z.string().min(1),
    originCountry: z.string().min(1), farmCoordinates: z.tuple([z.number(), z.number()]), harvestDate: z.string().min(1),
    grade: z.string().optional(), fairTradeCertified: z.boolean().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: generateFarmToForkPassport(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Credit & Insurance ─────────────────────────────────────────────────────
router.post('/credit/score', checkUsageLimit('ai_chat'), validate({ body: z.object({
    farmerId: z.string().min(1), farmerName: z.string().min(1), acreage: z.number().positive(),
    advisoryCompliancePct: z.number().min(0).max(100), completedCropCycles: z.number().int().min(0),
    historicalYieldAttainmentPct: z.number().min(0).max(100), hasSoilTest: z.boolean(),
    soilOrganicMatterPct: z.number().min(0).max(100).optional(), fulfilledOfftakeDeliveriesPct: z.number().min(0).max(100),
    hasDiversifiedCrops: z.boolean(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: computeAgronomicCreditScore(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/credit/insurance-evaluate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    policy: z.object({ policyId: z.string(), farmerId: z.string(), crop: z.string(), acreage: z.number(), coverageType: z.string(), sumInsuredKes: z.number(), premiumKes: z.number(), strikeThresholdValue: z.number(), monitoringWindowDays: z.number(), status: z.string() }),
    observedMetric: z.number(), verificationSource: z.string().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try {
        const { policy, observedMetric, verificationSource } = req.body as { policy: Parameters<typeof evaluateParametricInsuranceClaim>[0]; observedMetric: number; verificationSource?: string };
        return res.json({ success: true, data: evaluateParametricInsuranceClaim(policy as never, observedMetric, verificationSource) });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Pest Radar ─────────────────────────────────────────────────────────────
router.post('/pest/cluster', checkUsageLimit('ai_chat'), validate({ body: z.object({
    sightings: z.array(z.object({ id: z.string(), pestType: z.string(), lat: z.number(), lng: z.number(), county: z.string(), severity: z.string(), reportedAt: z.string(), reporterRole: z.string() })), epsilonKm: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: clusterPestSightings(req.body.sightings as never, req.body.epsilonKm) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/pest/forecast', checkUsageLimit('ai_chat'), validate({ body: z.object({
    cluster: z.object({ clusterId: z.string(), pestType: z.string(), centroid: z.tuple([z.number(), z.number()]), sightingCount: z.number(), radiusKm: z.number(), severityLevel: z.string() }),
    windSpeedKmh: z.number(), windDirectionDegrees: z.number(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: forecastSwarmTrajectory(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Trade & Market ─────────────────────────────────────────────────────────
router.post('/trade/arbitrage', checkUsageLimit('ai_chat'), validate({ body: z.object({ commodity: z.string().min(1), minNetMarginPct: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: findCrossBorderArbitrage(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/offtake/aggregate', checkUsageLimit('ai_chat'), validate({ body: z.object({ crop: z.string().min(1), county: z.string().min(1), totalAcreage: z.number().positive() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: aggregateHarvestProjections(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/offtake/match', checkUsageLimit('ai_chat'), validate({ body: z.object({ crop: z.string().min(1), county: z.string().min(1), totalAcreage: z.number().positive() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: matchOfftakerContracts(req.body) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Inputs & Mechanization ─────────────────────────────────────────────────
router.post('/suppliers/nearby', checkUsageLimit('ai_chat'), validate({ body: z.object({ lat: z.number(), lng: z.number(), radiusKm: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { dealers, provenance } = await findNearbySuppliersLive(req.body);
        return res.json({ success: true, data: { dealers, provenance } });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/suppliers/verify-batch', checkUsageLimit('ai_chat'), validate({ body: z.object({ batchNumber: z.string().min(1) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: verifyBatchNumber(req.body.batchNumber) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/mechanization/search', checkUsageLimit('ai_chat'), validate({ body: z.object({ county: z.string().min(1), assetType: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: findAvailableEquipment(req.body as never).equipment }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/mechanization/drone-plan', checkUsageLimit('ai_chat'), validate({ body: z.object({ targetCrop: z.string().min(1), pestTarget: z.string().min(1), totalHectares: z.number().positive(), farmerIds: z.array(z.string()), tankCapacityLiters: z.number().optional(), applicationRateLPerHa: z.number().optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: planDroneSprayMission(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── IoT Telemetry ──────────────────────────────────────────────────────────
router.post('/iot/evaluate', checkUsageLimit('ai_chat'), validate({ body: z.object({
    soilProbe: z.object({ vwcPct: z.number(), ecDsM: z.number(), soilTempC: z.number() }).optional(),
    weather: z.object({ tempC: z.number(), rhPct: z.number() }).optional(),
})}), async (req: AuthRequest, res: Response) => {
    try {
        const { soilProbe, weather } = req.body as { soilProbe?: Parameters<typeof evaluateSmartIrrigation>[0]; weather?: { tempC: number; rhPct: number } };
        // calculateVpdKPa is pure math; evaluateSmartIrrigation orchestrates
        const vpd = weather ? calculateVpdKPa(weather.tempC, weather.rhPct) : null;
        const irrigation = soilProbe ? evaluateSmartIrrigation(soilProbe as never) : null;
        return res.json({ success: true, data: { vpdKPa: vpd, irrigation } });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Satellite NDVI ─────────────────────────────────────────────────────────
router.post('/satellite/analyze', checkUsageLimit('ai_chat'), validate({ body: z.object({
    parcelId: z.string().min(1), pixels: z.array(z.object({ bandRed: z.number(), bandNir: z.number(), bandGreen: z.number().optional(), bandSwir: z.number().optional() })).min(1),
    cloudCoverPct: z.number().optional(), baselineNdvi: z.number().optional(),
})}), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: analyzeParcelMultispectral(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Soil Carbon & ROI ──────────────────────────────────────────────────────
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

// ── Weather Hazard ─────────────────────────────────────────────────────────
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

// ── Voice / IVR ────────────────────────────────────────────────────────────
router.post('/voice/transcribe', checkUsageLimit('speech'), validate({ body: z.object({ audio: z.string().optional(), audioUrl: z.string().optional(), mimeType: z.string().optional(), languageHint: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { audio, audioUrl, mimeType, languageHint } = req.body as { audio?: string; audioUrl?: string; mimeType?: string; languageHint?: string };
        if (!audio && !audioUrl) {
            // Fail loudly at the boundary: without input audio the service can
            // only return its offline CI stub transcript, which must never be
            // served over HTTP as if it were a real transcription.
            return res.status(400).json({ success: false, error: 'Audio data or audioUrl is required' });
        }
        const audioBuffer = audio ? Buffer.from(audio.includes('base64,') ? audio.split('base64,')[1] : audio, 'base64') : undefined;
        const result = await transcribeVoiceNote({ audioBuffer, audioUrl, mimeType, languageHint });
        return res.json({ success: true, data: result });
    } catch (e) { logger.error('Pillar transcribe failed:', e); return safeError(res, 500, (e as Error).message); }
});

router.post('/voice/transcribe-local', checkUsageLimit('speech'), validate({ body: z.object({ audio: z.string().optional(), audioUrl: z.string().optional(), mimeType: z.string().optional(), languageHint: z.string().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const { audio, languageHint } = req.body as { audio?: string; audioUrl?: string; mimeType?: string; languageHint?: string };
        const audioBuffer = audio ? Buffer.from(audio.includes('base64,') ? audio.split('base64,')[1] : audio, 'base64') : undefined;
        // Use local Whisper transcription service (free, offline-capable)
        const { whisperTranscriptionService } = await import('@/services/whisperTranscriptionService');
        if (!audioBuffer) {
          throw new Error('No audio buffer provided');
        }
        const result = await whisperTranscriptionService.transcribe(audioBuffer, {
          language: languageHint === 'sw' ? 'sw' : languageHint === 'en' ? 'en' : 'auto',
        });
        return res.json({ success: true, data: { ...result, provider: 'local-whisper' } });
    } catch (e) {
      logger.error('Local Whisper transcribe failed:', e);
      // Fallback to OpenAI if local fails
      const result = await transcribeVoiceNote(req.body as never);
      return res.json({ success: true, data: { ...result, provider: 'openai-fallback' } });
    }
});
router.post('/voice/synthesize', checkUsageLimit('speech'), validate({ body: z.object({ text: z.string().min(1), language: z.enum(['sw','en']).optional() }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await synthesizeVoiceAdvisory(req.body as never) }); } catch (e) { logger.error('Pillar synthesize failed:', e); return safeError(res, 500, (e as Error).message); }
});
router.post('/voice/ivr-xml', checkUsageLimit('ai_chat'), validate({ body: z.object({ alertTitle: z.string().min(1), advisorySwahili: z.string().min(1), advisoryEnglish: z.string().optional(), repeatAllowed: z.boolean().optional() }) }), async (req: AuthRequest, res: Response) => {
    try {
        const xml = generateIvrXml(req.body as never);
        res.setHeader('Content-Type', 'application/xml');
        return res.send(xml);
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/voice/ivr-dtmf', checkUsageLimit('ai_chat'), validate({ body: z.object({ digit: z.string().min(1).max(2) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: processDtmfResponse(req.body.digit) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/voice/broadcast', checkUsageLimit('ai_chat'), validate({ body: z.object({ farmerPhones: z.array(z.string()).min(1), alertTitle: z.string().min(1), advisorySwahili: z.string().min(1), advisoryEnglish: z.string().min(1) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: await dispatchVoiceBroadcast(req.body as never) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

// ── Tenant Federation ──────────────────────────────────────────────────────
router.get('/tenant/:slug', async (req: AuthRequest, res: Response) => {
    try {
        const tenant = getTenantBySlug(req.params.slug);
        if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });
        return res.json({ success: true, data: tenant });
    } catch (e) { return safeError(res, 500, (e as Error).message); }
});
router.post('/tenant/advisory-compliance', checkUsageLimit('ai_chat'), validate({ body: z.object({ tenantId: z.string().min(1), crop: z.string().min(1), proposedChemicals: z.array(z.string()) }) }), async (req: AuthRequest, res: Response) => {
    try { return res.json({ success: true, data: validateTenantAdvisoryCompliance(req.body.tenantId, req.body.crop, req.body.proposedChemicals) }); } catch (e) { return safeError(res, 500, (e as Error).message); }
});

export default router;
