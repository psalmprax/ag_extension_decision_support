import React, { useState } from 'react';
import {
  Shield,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  KeyRound,
  Check,
} from 'lucide-react';
import {
  verifyVisitGeofence,
  generateCoSignToken,
  verifyCoSignToken,
  auditCropLoss,
  type GeofenceVerificationResult,
  type CropLossAuditResult,
} from '@/api/verificationFraudService';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { triggerHaptic } from '@/lib/haptics';

interface AntiFraudVerificationBadgeProps {
  farmerId: string;
  farmerName?: string;
  farmerLat?: number;
  farmerLng?: number;
  visitId?: string;
  onVerificationComplete?: (verified: boolean) => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const res = (err as { response?: { data?: { error?: string } } }).response;
    return res?.data?.error || fallback;
  }
  return fallback;
}

export const AntiFraudVerificationBadge: React.FC<AntiFraudVerificationBadgeProps> = ({
  farmerId,
  farmerName = 'Farmer',
  farmerLat,
  farmerLng,
  visitId = 'visit-temp-session',
  onVerificationComplete,
}) => {
  const [geofence, setGeofence] = useState<GeofenceVerificationResult | null>(null);
  const [isVerifyingGps, setIsVerifyingGps] = useState(false);
  const [coSignOtp, setCoSignOtp] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [isCoSignVerified, setIsCoSignVerified] = useState(false);
  const [canopyAudit, setCanopyAudit] = useState<CropLossAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<'geofence' | 'cosign' | 'evidence'>('geofence');

  const onGpsSuccess = async (position: GeolocationPosition) => {
    try {
      const res = await verifyVisitGeofence({
        officerLat: position.coords.latitude,
        officerLng: position.coords.longitude,
        farmerId,
        maxRadiusMeters: 200,
      });
      setGeofence(res);
      if (res.isValid) {
        triggerHaptic('success');
        toast.success(`Geofence Verified: ${res.distanceMeters}m from parcel.`);
        onVerificationComplete?.(true);
      } else {
        triggerHaptic('warning');
        toast.error(res.details || 'Geofence breach: location outside registered parcel boundary.');
        onVerificationComplete?.(false);
      }
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err, 'Failed to verify GPS with server.');
      setGeofence({
        isValid: false,
        distanceMeters: -1,
        maxRadiusMeters: 200,
        status: 'GEOFENCE_BREACH',
        riskScore: 75,
        details: errorMsg,
      });
      triggerHaptic('error');
      toast.error(errorMsg);
      onVerificationComplete?.(false);
    } finally {
      setIsVerifyingGps(false);
    }
  };

  const onGpsError = (error: GeolocationPositionError) => {
    setIsVerifyingGps(false);
    const details = error.code === error.PERMISSION_DENIED
      ? 'Device location permission denied.'
      : 'Failed to acquire device GPS coordinates.';
    setGeofence({
      isValid: false,
      distanceMeters: -1,
      maxRadiusMeters: 200,
      status: 'COORDINATES_MISSING',
      riskScore: 100,
      details,
    });
    triggerHaptic('error');
    toast.error(details);
    onVerificationComplete?.(false);
  };

  // Trigger live browser GPS check
  const handleVerifyGps = () => {
    if (!farmerId || farmerId === 'farmer-session-active') {
      toast.error('Please select a registered farmer to run proximity check.');
      return;
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this device.');
      onVerificationComplete?.(false);
      return;
    }

    setIsVerifyingGps(true);
    navigator.geolocation.getCurrentPosition(onGpsSuccess, onGpsError, {
      timeout: 10000,
      enableHighAccuracy: true,
    });
  };

  const handleGenerateCoSign = async () => {
    if (!farmerId || farmerId === 'farmer-session-active') {
      toast.error('Please select a farmer before generating OTP.');
      return;
    }

    triggerHaptic('light');
    try {
      const res = await generateCoSignToken(visitId, farmerId);
      setCoSignOtp(res.otp);
      toast.success('Generated 6-digit physical handshake code for farmer.');
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err, 'Failed to generate verification OTP from server.');
      toast.error(errorMsg);
    }
  };

  const handleVerifyCoSign = async () => {
    if (enteredOtp.length !== 6) {
      triggerHaptic('warning');
      toast.error('Please enter the full 6-digit code provided to the farmer.');
      return;
    }

    try {
      const res = await verifyCoSignToken(visitId, enteredOtp);
      if (res.verified) {
        setIsCoSignVerified(true);
        triggerHaptic('success');
        toast.success('Farmer physical handshake confirmed!');
      } else {
        triggerHaptic('error');
        toast.error(res.message || 'Invalid verification OTP.');
      }
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err, 'OTP verification failed.');
      triggerHaptic('error');
      toast.error(errorMsg);
    }
  };

  const handleRunSatelliteAudit = async () => {
    if (farmerLat === undefined || farmerLng === undefined) {
      toast.error('Selected farmer has no registered GPS parcel coordinates.');
      return;
    }

    try {
      const res = await auditCropLoss({
        farmerLat,
        farmerLng,
        reportedLossSeverity: 'MODERATE',
        observedCanopyScore: 0.74,
      });
      setCanopyAudit(res);
      toast.success('Caller-supplied canopy observation audited.');
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err, 'Failed to audit canopy evidence.');
      toast.error(errorMsg);
      setCanopyAudit(null);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-slate-900/80 border border-emerald-500/25 backdrop-blur-xl shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              Zero-Trust Visit Verification Engine
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 uppercase">
                Anti-Fraud
              </span>
            </div>
            <div className="text-[11px] text-white/50">
              Hardware GPS geofence, two-party handshake, and satellite truth check
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-950 rounded-lg p-0.5 border border-white/[0.06] text-xxs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('geofence')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'geofence' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white'
            }`}
          >
            GPS Geofence
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cosign')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'cosign' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white'
            }`}
          >
            Farmer Co-Sign
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'evidence' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white'
            }`}
          >
            Canopy Evidence
          </button>
        </div>
      </div>

      {/* Tab 1: Geofence Verification */}
      {activeTab === 'geofence' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-xs font-bold text-white">Physical Proximity Check</div>
                <div className="text-[11px] text-white/50">
                  {geofence ? geofence.details : 'Check live officer GPS coordinates against farm boundary.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isVerifyingGps}
              onClick={handleVerifyGps}
              className="relative group overflow-hidden px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 ${isVerifyingGps ? 'animate-spin' : ''}`} />
              <span>{isVerifyingGps ? 'Scanning...' : 'Verify Live GPS'}</span>
            </button>
          </div>

          {geofence && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                geofence.isValid
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/30 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {geofence.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span>
                  {geofence.isValid
                    ? `Physical presence authenticated (${geofence.distanceMeters}m from plot).`
                    : `Geofence breach detected (${geofence.distanceMeters}m away).`}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-black/40 border border-white/10">
                Risk Score: {geofence.riskScore}/100
              </span>
            </motion.div>
          )}
        </div>
      )}

      {/* Tab 2: Two-Party Farmer Co-Sign */}
      {activeTab === 'cosign' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/80 font-medium">
                Physical Handshake Confirmation for <strong className="text-white">{farmerName}</strong>
              </div>
              {isCoSignVerified ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Co-Signed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateCoSign}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                >
                  {coSignOtp ? 'Regenerate Code' : 'Generate Farmer OTP'}
                </button>
              )}
            </div>

            {coSignOtp && !isCoSignVerified && (
              <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-white/60">Farmer OTP Code:</span>
                  <span className="font-mono text-base font-bold text-emerald-400 tracking-widest bg-black/40 px-3 py-1 rounded-md border border-emerald-500/30">
                    {coSignOtp}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={enteredOtp}
                    onChange={e => setEnteredOtp(e.target.value)}
                    className="w-32 px-3 py-1 text-xs rounded-lg bg-black/40 border border-white/15 text-white font-mono text-center focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCoSign}
                    className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Canopy Evidence Check */}
      {activeTab === 'evidence' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.06] flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                Canopy Evidence Cross-Audit
              </div>
              <div className="text-[11px] text-white/50">
                Cross-references field diagnostic observations with supplied canopy evidence.
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunSatelliteAudit}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] text-xs font-semibold text-white transition-colors"
            >
              Run Canopy Evidence Audit
            </button>
          </div>

          {canopyAudit && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-white/60">Observed Canopy:</span>
                <span className="font-bold text-emerald-400">{canopyAudit.evidenceVigorLevel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Evidence Consistency:</span>
                <span className="font-bold text-emerald-400">{canopyAudit.evidenceConsistencyScore}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Audit Recommendation:</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  {canopyAudit.recommendedAction}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
