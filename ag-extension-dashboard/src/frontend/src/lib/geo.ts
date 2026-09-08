/**
 * Device GPS helpers for field workflows (e.g. saving a farmer's field
 * location so satellite soil estimates can load). Pure capability wrapper —
 * UI state and persistence stay in the calling component.
 */

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

const UNAVAILABLE_MESSAGE =
  'Location is not available on this device — enter the field location on the farmer profile instead.';
const PERMISSION_MESSAGE =
  'Location permission denied — allow it in the browser settings, or enter the field location on the farmer profile.';
const UNREADABLE_MESSAGE = 'Could not read GPS. Try again outdoors with a clear view of the sky.';

/**
 * Resolves with one GPS fix or rejects with an Error whose message is safe
 * to show directly to field users.
 */
export function requestGpsFix(timeoutMs = 15000): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error(UNAVAILABLE_MESSAGE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null,
        }),
      err => {
        reject(
          new Error(err.code === err.PERMISSION_DENIED ? PERMISSION_MESSAGE : UNREADABLE_MESSAGE)
        );
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
