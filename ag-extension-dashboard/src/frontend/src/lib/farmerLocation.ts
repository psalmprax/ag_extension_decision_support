/**
 * A farmer's saved farm position, or null when none was recorded.
 * The API sends `locationLat`/`locationLng` (Postgres decimals arrive as
 * strings); demo records use numeric `latitude`/`longitude`. Missing or
 * out-of-range values are null: the map never invents a position.
 */
type Coordinate = number | string | null | undefined;

export function farmerCoordinates(
  farmer: { latitude?: Coordinate; longitude?: Coordinate; locationLat?: Coordinate; locationLng?: Coordinate }
): { lat: number; lng: number } | null {
  const lat = toNumber(farmer.latitude ?? farmer.locationLat);
  const lng = toNumber(farmer.longitude ?? farmer.locationLng);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function toNumber(value: Coordinate): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
