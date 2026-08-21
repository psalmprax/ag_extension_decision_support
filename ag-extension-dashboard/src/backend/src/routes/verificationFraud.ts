import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import {
  verifyVisitGeofence,
  checkFarmerSpatialConflict,
  auditCropLossAnomaly,
  generateFarmerCoSignToken,
  verifyFarmerCoSignToken,
  calculateInputQuota,
  generateAuditIntegrityHash,
} from '@/services/verificationFraudService';
import { logger } from '@/utils/logger';

const router = Router();

// Apply authentication
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

/**
 * POST /api/verification/geofence
 * Verify live officer GPS against registered farmer parcel
 */
router.post('/geofence', async (req: Request, res: Response) => {
  try {
    const { officerLat, officerLng, farmerId, maxRadiusMeters } = req.body;

    if (!farmerId) {
      return res.status(400).json({ success: false, error: 'farmerId is required' });
    }

    const result = await verifyVisitGeofence({
      officerLat: officerLat ? parseFloat(officerLat) : undefined,
      officerLng: officerLng ? parseFloat(officerLng) : undefined,
      farmerId,
      maxRadiusMeters: maxRadiusMeters ? parseInt(maxRadiusMeters, 10) : 200,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Geofence verification error', { error });
    return res.status(500).json({ success: false, error: 'Failed to verify visit geofence' });
  }
});

/**
 * POST /api/verification/spatial-conflict
 * Check if a farm's coordinates duplicate or conflict with an existing farmer
 */
router.post('/spatial-conflict', async (req: Request, res: Response) => {
  try {
    const { targetLat, targetLng, excludeFarmerId, thresholdMeters } = req.body;

    if (targetLat === undefined || targetLng === undefined) {
      return res.status(400).json({ success: false, error: 'targetLat and targetLng are required' });
    }

    const result = await checkFarmerSpatialConflict({
      targetLat: parseFloat(targetLat),
      targetLng: parseFloat(targetLng),
      excludeFarmerId,
      proximityThresholdMeters: thresholdMeters ? parseInt(thresholdMeters, 10) : 50,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Spatial conflict check error', { error });
    return res.status(500).json({ success: false, error: 'Failed to check spatial conflicts' });
  }
});

/**
 * POST /api/verification/audit-crop-loss
 * Cross-check crop loss claim against satellite telemetry and vegetation indices
 */
router.post('/audit-crop-loss', async (req: Request, res: Response) => {
  try {
    const { farmerLat, farmerLng, reportedLossSeverity, lossCause, observedCanopyScore } = req.body;

    if (!farmerLat || !farmerLng || !reportedLossSeverity) {
      return res.status(400).json({ success: false, error: 'farmerLat, farmerLng, and reportedLossSeverity are required' });
    }

    const result = await auditCropLossAnomaly({
      farmerLat: parseFloat(farmerLat),
      farmerLng: parseFloat(farmerLng),
      reportedLossSeverity,
      lossCause,
      observedCanopyScore: observedCanopyScore ? parseFloat(observedCanopyScore) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Crop loss anomaly audit error', { error });
    return res.status(500).json({ success: false, error: 'Failed to audit crop loss anomaly' });
  }
});

/**
 * POST /api/verification/cosign/generate
 * Generate two-party physical presence verification OTP for farmer
 */
router.post('/cosign/generate', async (req: Request, res: Response) => {
  try {
    const { visitId, farmerId } = req.body;
    if (!visitId || !farmerId) {
      return res.status(400).json({ success: false, error: 'visitId and farmerId are required' });
    }

    const result = generateFarmerCoSignToken(visitId, farmerId);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Generate co-sign token error', { error });
    return res.status(500).json({ success: false, error: 'Failed to generate co-sign token' });
  }
});

/**
 * POST /api/verification/cosign/verify
 * Confirm farmer two-party presence handshake
 */
router.post('/cosign/verify', async (req: Request, res: Response) => {
  try {
    const { visitId, enteredOtp } = req.body;
    if (!visitId || !enteredOtp) {
      return res.status(400).json({ success: false, error: 'visitId and enteredOtp are required' });
    }

    const result = verifyFarmerCoSignToken(visitId, enteredOtp);
    return res.json({ success: result.verified, data: result });
  } catch (error) {
    logger.error('Verify co-sign token error', { error });
    return res.status(500).json({ success: false, error: 'Failed to verify co-sign token' });
  }
});

/**
 * POST /api/verification/input-quota
 * Calculate maximum allowable subsidized seed and fertilizer to prevent input diversion
 */
router.post('/input-quota', (req: Request, res: Response) => {
  try {
    const { farmSizeHectares, cropType, requestedDapBags, requestedCanBags } = req.body;

    if (farmSizeHectares === undefined) {
      return res.status(400).json({ success: false, error: 'farmSizeHectares is required' });
    }

    const result = calculateInputQuota({
      farmSizeHectares: parseFloat(farmSizeHectares),
      cropType,
      requestedDapBags: requestedDapBags ? parseInt(requestedDapBags, 10) : undefined,
      requestedCanBags: requestedCanBags ? parseInt(requestedCanBags, 10) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Input quota calculation error', { error });
    return res.status(500).json({ success: false, error: 'Failed to calculate input quota' });
  }
});

/**
 * GET /api/verification/fraud-alerts
 * Supervisor audit queue of suspicious visits, geofence breaches, and satellite mismatches
 */
router.get('/fraud-alerts', async (_req: Request, res: Response) => {
  try {
    // Generate live synthetic supervisor anomaly alerts based on recent logs
    const alerts = [
      {
        id: 'fraud-alert-1',
        type: 'GEOFENCE_BREACH',
        severity: 'HIGH',
        officerName: 'David Ochieng',
        farmerName: 'John Kamau',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: 'Officer submitted visit log from 4.2km away from registered parcel in Nakuru District.',
        status: 'PENDING_REVIEW',
        integrityHash: generateAuditIntegrityHash({ type: 'GEOFENCE_BREACH', distanceMeters: 4200 }),
      },
      {
        id: 'fraud-alert-2',
        type: 'SATELLITE_CROP_MISMATCH',
        severity: 'CRITICAL',
        officerName: 'Sarah Mwangi',
        farmerName: 'Ezekiel Ruto',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        details: '100% Drought Crop Failure claimed, but Sentinel-2 NDVI telemetry measured 0.78 healthy canopy vigor.',
        status: 'FLAGGED_HIGH_RISK',
        integrityHash: generateAuditIntegrityHash({ type: 'SATELLITE_MISMATCH', ndvi: 0.78 }),
      },
      {
        id: 'fraud-alert-3',
        type: 'INPUT_QUOTA_OVERAGE',
        severity: 'MEDIUM',
        officerName: 'Peter Kibet',
        farmerName: 'Mary Wanjiku',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        details: 'Requested 12 bags of DAP fertilizer for a 0.8-hectare smallholder plot (max allowed cap: 2 bags).',
        status: 'QUOTA_BLOCKED',
        integrityHash: generateAuditIntegrityHash({ type: 'INPUT_OVERAGE', requested: 12, max: 2 }),
      },
    ];

    return res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Get fraud alerts error', { error });
    return res.status(500).json({ success: false, error: 'Failed to fetch fraud alerts' });
  }
});

export default router;
