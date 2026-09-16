import apiClient from './client';

export interface GeofenceVerificationResult {
  isValid: boolean;
  distanceMeters: number;
  maxRadiusMeters: number;
  status: 'VERIFIED' | 'GEOFENCE_BREACH' | 'COORDINATES_MISSING';
  riskScore: number;
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
  anomalyScore: number;
  reportedLossSeverity: string;
  evidenceVigorLevel: string;
  evidenceConsistencyScore: number;
  evidenceSource: 'CALLER_OBSERVATION' | 'NO_CANOPY_OBSERVATION';
  flagReason: string | null;
  recommendedAction: 'AUTO_APPROVED' | 'REQUIRES_SUPERVISOR_AUDIT' | 'FLAGGED_HIGH_RISK';
}

export interface FraudAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  officerName: string;
  farmerName: string;
  timestamp: string;
  details: string;
  status: string;
  integrityHash: string;
}

export async function verifyVisitGeofence(params: {
  officerLat?: number | null;
  officerLng?: number | null;
  farmerId: string;
  maxRadiusMeters?: number;
}): Promise<GeofenceVerificationResult> {
  const response = await apiClient.post('/verification/geofence', params);
  return response.data.data;
}


export async function auditCropLoss(params: {
  farmerLat: number;
  farmerLng: number;
  reportedLossSeverity: string;
  lossCause?: string;
  observedCanopyScore?: number;
}): Promise<CropLossAuditResult> {
  const response = await apiClient.post('/verification/audit-crop-loss', params);
  return response.data.data;
}

export async function generateCoSignToken(visitId: string, farmerId: string): Promise<{ otp: string; expiresInSeconds: number }> {
  const response = await apiClient.post('/verification/cosign/generate', { visitId, farmerId });
  return response.data.data;
}

export async function verifyCoSignToken(visitId: string, enteredOtp: string): Promise<{ verified: boolean; message: string }> {
  const response = await apiClient.post('/verification/cosign/verify', { visitId, enteredOtp });
  return response.data.data;
}

export interface DwellTimeVerificationResult {
  isValid: boolean;
  dwellTimeMinutes: number;
  minimumRequiredMinutes: number;
  status: 'VERIFIED' | 'INSUFFICIENT_DWELL_TIME' | 'STATIONARY_SPOOFING_DETECTED' | 'INVALID_TIMESTAMPS';
  riskScore: number;
  details: string;
  integrityHash: string;
}

export async function verifyParcelDwellTime(params: {
  startedAt?: string | null;
  completedAt?: string | null;
  durationMinutes?: number | null;
  officerId?: string;
  farmerId?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  priorVisit?: {
    farmerId?: string | null;
    completedAt?: string | null;
    locationLat?: number | null;
    locationLng?: number | null;
  } | null;
  minimumRequiredMinutes?: number;
}): Promise<DwellTimeVerificationResult> {
  const response = await apiClient.post('/verification/dwell-time', params);
  return response.data.data;
}
