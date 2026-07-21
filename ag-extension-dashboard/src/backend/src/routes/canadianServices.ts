import { Router, Request, Response } from 'express';
import { OCapConsentService, OCapConsentPolicy } from '../services/ocapConsentService';
import { CanadianRegulatoryEngine } from '../services/canadianRegulatoryEngine';
import { CanadianClimateDownscaler, CanadianAgroZone } from '../services/canadianClimateDownscaler';

const router = Router();

/**
 * POST /api/v1/canadian/ocap/consent
 * Enforce OCAP® Indigenous Data Sovereignty policy on farm telemetry
 */
router.post('/ocap/consent', (req: Request, res: Response) => {
  const { data, policy } = req.body as { data: Record<string, unknown>; policy: OCapConsentPolicy };
  if (!data || !policy) {
    res.status(400).json({ success: false, error: 'Missing data or policy payload' });
    return;
  }

  const stampedData = OCapConsentService.enforceOCapPolicy(data, policy);
  res.json({ success: true, data: stampedData });
});

/**
 * POST /api/v1/canadian/regulatory/check
 * Validate agricultural chemical/treatment recommendations against Canadian Fertilizers & Pest Control Acts
 */
router.post('/regulatory/check', (req: Request, res: Response) => {
  const { treatmentName, activeIngredient, province, dosagePerHectare } = req.body as {
    treatmentName: string;
    activeIngredient: string;
    province: string;
    dosagePerHectare: number;
  };

  if (!treatmentName || !activeIngredient || !province) {
    res.status(400).json({ success: false, error: 'Missing treatment details' });
    return;
  }

  const result = CanadianRegulatoryEngine.validateTreatment(
    treatmentName,
    activeIngredient,
    province,
    dosagePerHectare || 100
  );
  res.json({ success: true, data: result });
});

/**
 * POST /api/v1/canadian/climate/assess
 * Assess micro-climate risks for Canadian Agro-Ecological Zones
 */
router.post('/climate/assess', (req: Request, res: Response) => {
  const { zone, temperatureCelsius, consecutiveDryDays } = req.body as {
    zone: CanadianAgroZone;
    temperatureCelsius: number;
    consecutiveDryDays: number;
  };

  const assessment = CanadianClimateDownscaler.assessZoneRisk(
    zone || 'prairie_drylands',
    temperatureCelsius ?? 15,
    consecutiveDryDays ?? 5
  );

  res.json({ success: true, data: assessment });
});

export default router;
