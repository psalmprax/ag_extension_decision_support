/** How far the camera starts: close enough to tell farms apart when they are near each other. */
export function startDistance(points: Array<{ lat: number; lon: number }>): number {
  if (points.length < 2) return 2.4;
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);
  const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lons) - Math.min(...lons));
  return Math.min(3.4, Math.max(1.45, 1.35 + spread / 25));
}
