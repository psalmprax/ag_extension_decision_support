/** Where this device is, for a visit report; null when it is unsupported, refused or too slow. */
export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** Metres: the device is within this radius of the point. */
  accuracy: number;
}

export function currentPosition(timeoutMs = 10_000): Promise<DevicePosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      error => {
        console.warn('Location for the visit report unavailable:', error.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
