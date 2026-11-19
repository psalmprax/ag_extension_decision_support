/**
 * Was the officer on the farm when they filed the visit report? The position
 * their device reported is compared with the farm's registered location, using
 * the same radius as the fraud review's geofence alerts.
 */
import { calculateHaversineDistance, GEOFENCE_RADIUS_M } from '@/services/verificationFraudService';

export type VisitLocationStatus = 'on_farm' | 'away' | 'imprecise' | 'farm_location_unknown' | 'not_shared';

export interface ReportedPosition {
  latitude: number;
  longitude: number;
  /** Radius in metres within which the device says it is (GeolocationCoordinates.accuracy). */
  accuracy: number;
}

export interface VisitLocationCheck {
  status: VisitLocationStatus;
  distanceM: number | null;
  accuracyM: number | null;
}

const asNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
};

export function checkVisitLocation(
  reported: ReportedPosition | null | undefined,
  farm: { lat: unknown; lng: unknown } | null | undefined,
): VisitLocationCheck {
  if (!reported) return { status: 'not_shared', distanceM: null, accuracyM: null };
  const accuracyM = Math.round(reported.accuracy * 10) / 10;
  const farmLat = asNumber(farm?.lat);
  const farmLng = asNumber(farm?.lng);
  if (farmLat === null || farmLng === null) return { status: 'farm_location_unknown', distanceM: null, accuracyM };
  const distanceM = calculateHaversineDistance(reported.latitude, reported.longitude, farmLat, farmLng);
  // A fix vaguer than the radius cannot say either way.
  if (reported.accuracy > GEOFENCE_RADIUS_M) return { status: 'imprecise', distanceM, accuracyM };
  return { status: distanceM <= GEOFENCE_RADIUS_M ? 'on_farm' : 'away', distanceM, accuracyM };
}
