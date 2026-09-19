import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { query } from '@/services/databaseService';
import {
  verifyVisitGeofence,
  checkFarmerSpatialConflict,
  auditCropLossAnomaly,
  generateFarmerCoSignToken,
  verifyFarmerCoSignToken,
  calculateInputQuota,
  generateAuditIntegrityHash,
  calculateHaversineDistance,
  verifyParcelDwellTime,
} from '@/services/verificationFraudService';
import { logger } from '@/utils/logger';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

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

    const principalTenantId = req.user?.userId ? await getPrincipalTenantId(req.user.userId) : null;
    const result = await checkFarmerSpatialConflict({
      targetLat: parseFloat(targetLat),
      targetLng: parseFloat(targetLng),
      excludeFarmerId,
      proximityThresholdMeters: thresholdMeters ? parseInt(thresholdMeters, 10) : 50,
      tenantId: principalTenantId || undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Spatial conflict check error', { error });
    return res.status(500).json({ success: false, error: 'Failed to check spatial conflicts' });
  }
});

/**
 * POST /api/verification/audit-crop-loss
 * Cross-check crop loss claim against caller-supplied canopy evidence
 */
router.post('/audit-crop-loss', async (req: Request, res: Response) => {
  try {
    const { farmerLat, farmerLng, reportedLossSeverity, lossCause, observedCanopyScore } = req.body;

    if (farmerLat === undefined || farmerLng === undefined || !reportedLossSeverity) {
      return res.status(400).json({ success: false, error: 'farmerLat, farmerLng, and reportedLossSeverity are required' });
    }

    const parsedLat = parseFloat(farmerLat);
    const parsedLng = parseFloat(farmerLng);
    const parsedCanopyScore = observedCanopyScore === undefined ? undefined : parseFloat(observedCanopyScore);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      return res.status(400).json({ success: false, error: 'farmerLat and farmerLng must be valid numbers' });
    }
    if (parsedCanopyScore !== undefined && !Number.isFinite(parsedCanopyScore)) {
      return res.status(400).json({ success: false, error: 'observedCanopyScore must be a valid number' });
    }

    const result = await auditCropLossAnomaly({
      farmerLat: parsedLat,
      farmerLng: parsedLng,
      reportedLossSeverity,
      lossCause,
      observedCanopyScore: parsedCanopyScore,
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

    const result = await generateFarmerCoSignToken(visitId, farmerId);
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

    const result = await verifyFarmerCoSignToken(visitId, enteredOtp);
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
 * POST /api/verification/dwell-time
 * Verify minimum parcel dwell time and detect stationary spoofing (AD-002 / CE-003)
 */
router.post('/dwell-time', (req: Request, res: Response) => {
  try {
    const {
      startedAt,
      completedAt,
      durationMinutes,
      officerId,
      farmerId,
      locationLat,
      locationLng,
      priorVisit,
      minimumRequiredMinutes,
    } = req.body;

    const result = verifyParcelDwellTime({
      startedAt,
      completedAt,
      durationMinutes: durationMinutes !== undefined ? parseFloat(durationMinutes) : undefined,
      officerId,
      farmerId,
      locationLat: locationLat !== undefined ? parseFloat(locationLat) : undefined,
      locationLng: locationLng !== undefined ? parseFloat(locationLng) : undefined,
      priorVisit: priorVisit
        ? {
            farmerId: priorVisit.farmerId,
            completedAt: priorVisit.completedAt,
            locationLat: priorVisit.locationLat !== undefined ? parseFloat(priorVisit.locationLat) : undefined,
            locationLng: priorVisit.locationLng !== undefined ? parseFloat(priorVisit.locationLng) : undefined,
          }
        : undefined,
      minimumRequiredMinutes: minimumRequiredMinutes !== undefined ? parseInt(minimumRequiredMinutes, 10) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Dwell-time verification error', { error });
    return res.status(500).json({ success: false, error: 'Failed to verify parcel dwell time' });
  }
});

interface GeofenceEvidenceRow {
  visit_id: string;
  officer_first_name: string | null;
  officer_last_name: string | null;
  farmer_first_name: string | null;
  farmer_last_name: string | null;
  visit_created_at: Date | string | null;
  visit_lat: string;
  visit_lng: string;
  farmer_lat: string;
  farmer_lng: string;
  visit_notes: string | null;
  visit_duration: number | null;
}

function buildVisitFraudAlerts(row: GeofenceEvidenceRow) {
  const generated: Array<{
    id: string;
    type: string;
    severity: string;
    officerName: string;
    farmerName: string;
    timestamp: string;
    details: string;
    status: string;
    integrityHash: string;
  }> = [];

  const officerName = [row.officer_first_name, row.officer_last_name].filter(Boolean).join(' ') || 'Unknown officer';
  const farmerName = [row.farmer_first_name, row.farmer_last_name].filter(Boolean).join(' ') || 'Unknown farmer';

  const distanceMeters = calculateHaversineDistance(
    Number(row.visit_lat),
    Number(row.visit_lng),
    Number(row.farmer_lat),
    Number(row.farmer_lng),
  );
  if (distanceMeters > 200) {
    generated.push({
      id: `visit-geofence-${row.visit_id}`,
      type: 'GEOFENCE_BREACH',
      severity: distanceMeters >= 1000 ? 'CRITICAL' : 'HIGH',
      officerName,
      farmerName,
      timestamp: new Date(row.visit_created_at || Date.now()).toISOString(),
      details: `Visit GPS was recorded ${distanceMeters}m from the farmer's registered parcel.`,
      status: 'PENDING_REVIEW',
      integrityHash: generateAuditIntegrityHash({
        visitId: row.visit_id,
        distanceMeters,
        visitLat: row.visit_lat,
        visitLng: row.visit_lng,
        farmerLat: row.farmer_lat,
        farmerLng: row.farmer_lng,
      }),
    });
  }

  // Stationary Dwell Anomaly Check (AD-002)
  if (row.visit_notes?.includes('STATIONARY ANOMALY') || (row.visit_duration != null && row.visit_duration < 10)) {
    generated.push({
      id: `visit-stationary-${row.visit_id}`,
      type: 'STATIONARY_FRAUD',
      severity: 'HIGH',
      officerName,
      farmerName,
      timestamp: new Date(row.visit_created_at || Date.now()).toISOString(),
      details: row.visit_notes?.includes('STATIONARY ANOMALY')
        ? row.visit_notes
        : `Visit logged with insufficient parcel dwell time (${row.visit_duration} mins < 10 min requirement).`,
      status: 'PENDING_REVIEW',
      integrityHash: generateAuditIntegrityHash({
        visitId: row.visit_id,
        duration: row.visit_duration,
        notes: row.visit_notes,
        type: 'STATIONARY_FRAUD',
      }),
    });
  }

  return generated;
}

/**
 * GET /api/verification/fraud-alerts
 * Supervisor audit queue of suspicious visits, geofence breaches, crop evidence mismatches, and stationary fraud
 */
router.get('/fraud-alerts', authorize(['admin', 'regional_manager']), async (req: Request, res: Response) => {
  try {
    const principalTenantId = req.user?.userId ? await getPrincipalTenantId(req.user.userId) : null;
    const alertTenantFilter = principalTenantId ? 'AND tenant_id = $1' : '';
    const visitTenantFilter = principalTenantId ? 'AND (f.tenant_id = $1 OR v.tenant_id = $1)' : '';
    const queryParams = principalTenantId ? [principalTenantId] : [];

    const persistedAlerts = await query<{
      id: string;
      type: string;
      severity: string | null;
      title: string;
      description: string | null;
      triggered_at: Date | string | null;
    }>(
      `SELECT id, type, severity, title, description, triggered_at
       FROM alerts
       WHERE is_active = TRUE
         AND type IN ('GEOFENCE_BREACH', 'CROP_EVIDENCE_MISMATCH', 'INPUT_QUOTA_OVERAGE', 'STATIONARY_FRAUD')
         ${alertTenantFilter}
       ORDER BY triggered_at DESC NULLS LAST
       LIMIT 100`,
      queryParams,
    );

    const geofenceEvidence = await query<GeofenceEvidenceRow>(
      `SELECT v.id AS visit_id,
              u.first_name AS officer_first_name,
              u.last_name AS officer_last_name,
              f.first_name AS farmer_first_name,
              f.last_name AS farmer_last_name,
              v.created_at AS visit_created_at,
              v.location_lat AS visit_lat,
              v.location_lng AS visit_lng,
              f.location_lat AS farmer_lat,
              f.location_lng AS farmer_lng,
              v.notes AS visit_notes,
              v.duration_minutes AS visit_duration
       FROM visits v
       JOIN farmers f ON f.id = v.farmer_id
       LEFT JOIN users u ON u.id = v.officer_id
       WHERE v.location_lat IS NOT NULL
         AND v.location_lng IS NOT NULL
         AND f.location_lat IS NOT NULL
         AND f.location_lng IS NOT NULL
         ${visitTenantFilter}
       ORDER BY v.created_at DESC
       LIMIT 100`,
      queryParams,
    );

    const alerts = [
      ...persistedAlerts.rows.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: (alert.severity || 'MEDIUM').toUpperCase(),
        officerName: 'Recorded alert',
        farmerName: 'Recorded alert',
        timestamp: new Date(alert.triggered_at || Date.now()).toISOString(),
        details: alert.description || alert.title,
        status: 'PENDING_REVIEW',
        integrityHash: generateAuditIntegrityHash({
          id: alert.id,
          type: alert.type,
          triggeredAt: alert.triggered_at,
        }),
      })),
      ...geofenceEvidence.rows.flatMap(buildVisitFraudAlerts),
    ];

    return res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Get fraud alerts error', { error });
    return res.status(500).json({ success: false, error: 'Failed to fetch fraud alerts' });
  }
});

export default router;
