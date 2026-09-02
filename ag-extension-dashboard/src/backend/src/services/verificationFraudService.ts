import { query } from '@/services/databaseService';
import crypto from 'crypto';

export interface GeofenceVerificationResult {
  isValid: boolean;
  distanceMeters: number;
  maxRadiusMeters: number;
  status: 'VERIFIED' | 'GEOFENCE_BREACH' | 'COORDINATES_MISSING';
  riskScore: number; // 0 (clean) to 100 (high fraud risk)
  details: string;
}

export interface SpatialConflictResult {
  isConflict: boolean;
  conflictingFarmers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    distanceMeters: number;
    village?: string;
  }>;
  details: string;
}

export interface CropLossAuditResult {
  anomalyDetected: boolean;
  anomalyScore: number; // 0 - 100
  reportedLossSeverity: string;
  evidenceVigorLevel: string;
  evidenceConsistencyScore: number; // 0 - 100
  evidenceSource: 'CALLER_OBSERVATION' | 'NO_CANOPY_OBSERVATION';
  flagReason: string | null;
  recommendedAction: 'AUTO_APPROVED' | 'REQUIRES_SUPERVISOR_AUDIT' | 'FLAGGED_HIGH_RISK';
}

export interface InputQuotaResult {
  farmSizeHectares: number;
  cropType: string;
  maxSeedKg: number;
  maxBasalFertilizerKg: number;
  maxTopdressFertilizerKg: number;
  isExceeded: boolean;
  quotaCapBreakdown: {
    recommendedDapBags: number;
    recommendedCanBags: number;
    maxCertifiedSeedPacks: number;
  };
}

// In-memory co-sign OTP store (with 15 min TTL)
const coSignStore = new Map<string, { otp: string; expiresAt: number; farmerId: string }>();

/**
 * Calculates Haversine distance between two GPS coordinates in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 1. Zero-Trust Field Visit Geofence Verification
 * Prevents "armchair" extension logging by comparing live officer GPS against registered farm coordinates.
 */
export async function verifyVisitGeofence(params: {
  officerLat?: number | null;
  officerLng?: number | null;
  farmerId: string;
  maxRadiusMeters?: number;
}): Promise<GeofenceVerificationResult> {
  const { officerLat, officerLng, farmerId, maxRadiusMeters = 200 } = params;

  if (officerLat === undefined || officerLat === null || officerLng === undefined || officerLng === null) {
    return {
      isValid: false,
      distanceMeters: -1,
      maxRadiusMeters,
      status: 'COORDINATES_MISSING',
      riskScore: 75,
      details: 'Officer device GPS coordinates were not provided or location permission was denied.',
    };
  }

  const farmerRes = await query<{
    location_lat: string | null;
    location_lng: string | null;
    first_name: string;
    last_name: string;
  }>(
    `SELECT location_lat, location_lng, first_name, last_name FROM farmers WHERE id = $1`,
    [farmerId]
  );

  const farmer = farmerRes.rows[0];
  if (!farmer || !farmer.location_lat || !farmer.location_lng) {
    return {
      isValid: true,
      distanceMeters: 0,
      maxRadiusMeters,
      status: 'VERIFIED',
      riskScore: 20,
      details: 'Farmer has no baseline GPS registered; visit coordinates captured as initial geofence baseline.',
    };
  }

  const farmerLat = parseFloat(farmer.location_lat);
  const farmerLng = parseFloat(farmer.location_lng);
  const distance = calculateHaversineDistance(officerLat, officerLng, farmerLat, farmerLng);

  if (distance <= maxRadiusMeters) {
    return {
      isValid: true,
      distanceMeters: distance,
      maxRadiusMeters,
      status: 'VERIFIED',
      riskScore: Math.min(10, Math.round((distance / maxRadiusMeters) * 10)),
      details: `Officer presence verified within ${distance}m of registered parcel (threshold: ${maxRadiusMeters}m).`,
    };
  }

  // Geofence Breach
  const riskScore = Math.min(100, 50 + Math.round((distance / maxRadiusMeters) * 10));
  return {
    isValid: false,
    distanceMeters: distance,
    maxRadiusMeters,
    status: 'GEOFENCE_BREACH',
    riskScore,
    details: `Officer was located ${distance}m away from the farmer's registered parcel (exceeds ${maxRadiusMeters}m geofence). Potential armchair visit.`,
  };
}

/**
 * 2. Spatial Duplicate & Ghost Farmer Conflict Check
 * Prevents double-dipping and duplicate ghost farmer registrations on the same land parcel.
 */
export async function checkFarmerSpatialConflict(params: {
  targetLat: number;
  targetLng: number;
  excludeFarmerId?: string;
  tenantId?: string | null;
  proximityThresholdMeters?: number;
}): Promise<SpatialConflictResult> {
  const {
    targetLat,
    targetLng,
    excludeFarmerId,
    tenantId,
    proximityThresholdMeters = 50,
  } = params;

  let queryText = `
    SELECT id, first_name, last_name, village, location_lat, location_lng
    FROM farmers
    WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL AND is_active = true
  `;
  const queryParams: unknown[] = [];

  if (excludeFarmerId) {
    queryParams.push(excludeFarmerId);
    queryText += ` AND id != $${queryParams.length}`;
  }

  if (tenantId) {
    queryParams.push(tenantId);
    queryText += ` AND tenant_id = $${queryParams.length}`;
  }

  const result = await query<{
    id: string;
    first_name: string;
    last_name: string;
    village: string | null;
    location_lat: string;
    location_lng: string;
  }>(queryText, queryParams);

  const conflictingFarmers: SpatialConflictResult['conflictingFarmers'] = [];

  for (const row of result.rows) {
    const lat = parseFloat(row.location_lat);
    const lng = parseFloat(row.location_lng);
    const dist = calculateHaversineDistance(targetLat, targetLng, lat, lng);

    if (dist <= proximityThresholdMeters) {
      conflictingFarmers.push({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        village: row.village || undefined,
        distanceMeters: dist,
      });
    }
  }

  if (conflictingFarmers.length > 0) {
    return {
      isConflict: true,
      conflictingFarmers,
      details: `Detected ${conflictingFarmers.length} existing farmer(s) registered within ${proximityThresholdMeters}m of this parcel. Potential double-dipping or duplicate record.`,
    };
  }

  return {
    isConflict: false,
    conflictingFarmers: [],
    details: 'Parcel coordinates verified distinct. No spatial overlap detected with active farmer registry.',
  };
}

/**
 * 3. Crop Loss Evidence Audit
 * Compares catastrophic crop loss or drought claims with caller-supplied canopy evidence.
 */
export async function auditCropLossAnomaly(params: {
  farmerLat: number;
  farmerLng: number;
  reportedLossSeverity: 'LOW' | 'MODERATE' | 'SEVERE' | 'TOTAL_FAILURE';
  lossCause?: string;
  observedCanopyScore?: number; // 0.0 - 1.0, supplied by an external field or sensor observation
}): Promise<CropLossAuditResult> {
  const { reportedLossSeverity, observedCanopyScore } = params;

  if (observedCanopyScore !== undefined && (!Number.isFinite(observedCanopyScore) || observedCanopyScore < 0 || observedCanopyScore > 1)) {
    throw new Error('observedCanopyScore must be between 0 and 1');
  }

  if (observedCanopyScore === undefined) {
    return {
      anomalyDetected: false,
      anomalyScore: 50,
      reportedLossSeverity,
      evidenceVigorLevel: 'No canopy observation supplied',
      evidenceConsistencyScore: 0,
      evidenceSource: 'NO_CANOPY_OBSERVATION',
      flagReason: 'No trusted canopy observation was supplied; claim requires manual evidence review.',
      recommendedAction: 'REQUIRES_SUPERVISOR_AUDIT',
    };
  }

  let evidenceVigorLevel = 'High (Observed)';
  if (observedCanopyScore < 0.3) evidenceVigorLevel = 'Critical Stress (Observed)';
  else if (observedCanopyScore < 0.55) evidenceVigorLevel = 'Moderate Stress (Observed)';

  if ((reportedLossSeverity === 'SEVERE' || reportedLossSeverity === 'TOTAL_FAILURE') && observedCanopyScore > 0.65) {
    return {
      anomalyDetected: true,
      anomalyScore: 88,
      reportedLossSeverity,
      evidenceVigorLevel,
      evidenceConsistencyScore: 22,
      evidenceSource: 'CALLER_OBSERVATION',
      flagReason: `Reported ${reportedLossSeverity} loss conflicts with the supplied high canopy observation (score: ${observedCanopyScore.toFixed(2)}).`,
      recommendedAction: 'FLAGGED_HIGH_RISK',
    };
  }

  if (reportedLossSeverity === 'TOTAL_FAILURE' && observedCanopyScore > 0.45) {
    return {
      anomalyDetected: true,
      anomalyScore: 65,
      reportedLossSeverity,
      evidenceVigorLevel,
      evidenceConsistencyScore: 45,
      evidenceSource: 'CALLER_OBSERVATION',
      flagReason: 'Reported total loss exceeds the supplied canopy stress observation; requires second inspection.',
      recommendedAction: 'REQUIRES_SUPERVISOR_AUDIT',
    };
  }

  return {
    anomalyDetected: false,
    anomalyScore: 12,
    reportedLossSeverity,
    evidenceVigorLevel,
    evidenceConsistencyScore: 94,
    evidenceSource: 'CALLER_OBSERVATION',
    flagReason: null,
    recommendedAction: 'AUTO_APPROVED',
  };
}

/**
 * 4. Two-Party Farmer Co-Sign Verification Token
 * Generates an ephemeral cryptographic 6-digit OTP code for physical handshake confirmation.
 */
export function generateFarmerCoSignToken(visitId: string, farmerId: string): {
  otp: string;
  expiresInSeconds: number;
} {
  // Use cryptographically secure random for OTP generation
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  const otp = Math.floor(100000 + (randomBuffer[0] % 900000)).toString();
  const ttlMs = 15 * 60 * 1000; // 15 minutes
  coSignStore.set(visitId, {
    otp,
    expiresAt: Date.now() + ttlMs,
    farmerId,
  });

  return {
    otp,
    expiresInSeconds: 900,
  };
}

export function verifyFarmerCoSignToken(visitId: string, enteredOtp: string): {
  verified: boolean;
  message: string;
} {
  const entry = coSignStore.get(visitId);
  if (!entry) {
    return { verified: false, message: 'No active co-sign request found for this visit.' };
  }

  if (Date.now() > entry.expiresAt) {
    coSignStore.delete(visitId);
    return { verified: false, message: 'Co-sign verification OTP has expired. Please generate a new code.' };
  }

  if (entry.otp !== enteredOtp.trim()) {
    return { verified: false, message: 'Invalid verification OTP entered.' };
  }

  coSignStore.delete(visitId);
  return { verified: true, message: 'Two-party farmer presence successfully verified.' };
}

/**
 * 5. Input Quota & Fertilizer Divergence Prevention
 * Calculates strict maximum subsidy limits based on acreage to eliminate bulk input diversion.
 */
export function calculateInputQuota(params: {
  farmSizeHectares: number;
  cropType?: string;
  requestedDapBags?: number;
  requestedCanBags?: number;
}): InputQuotaResult {
  const { farmSizeHectares, cropType = 'Maize', requestedDapBags = 0, requestedCanBags = 0 } = params;

  // Agronomic ceiling: Max 2 bags DAP (100kg) + 2 bags CAN (100kg) per hectare for maize
  const maxDapBags = Math.max(1, Math.ceil(farmSizeHectares * 2));
  const maxCanBags = Math.max(1, Math.ceil(farmSizeHectares * 2));
  const maxSeedPacks = Math.max(1, Math.ceil(farmSizeHectares * 4)); // 4x 2kg packs per hectare

  const isExceeded = requestedDapBags > maxDapBags || requestedCanBags > maxCanBags;

  return {
    farmSizeHectares,
    cropType,
    maxSeedKg: maxSeedPacks * 2,
    maxBasalFertilizerKg: maxDapBags * 50,
    maxTopdressFertilizerKg: maxCanBags * 50,
    isExceeded,
    quotaCapBreakdown: {
      recommendedDapBags: maxDapBags,
      recommendedCanBags: maxCanBags,
      maxCertifiedSeedPacks: maxSeedPacks,
    },
  };
}

/**
 * 6. Cryptographic Audit Hash-Chaining
 * Generates an immutable SHA-256 integrity signature for visit logs and input distributions.
 */
export function generateAuditIntegrityHash(record: Record<string, unknown>, previousHash = 'GENESIS_HASH'): string {
  const serialized = JSON.stringify(record, Object.keys(record).sort());
  return crypto.createHash('sha256').update(`${previousHash}:${serialized}`).digest('hex');
}
