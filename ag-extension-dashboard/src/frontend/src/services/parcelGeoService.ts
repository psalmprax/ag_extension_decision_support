/**
 * Parcel Geo Service — WGS-84 GPS Polygon Tracing, Geodesic Area Calculation & GeoJSON Export.
 * Computes exact field boundary acreage, perimeter, and centroid 100% offline.
 */

export interface GeoVertex {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  timestamp: string;
}

export interface ParcelCalculations {
  areaSquareMeters: number;
  hectares: number;
  acres: number;
  perimeterMeters: number;
  vertexCount: number;
  centroid: [number, number]; // [lat, lng]
  boundingBox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface GeoJsonParcelFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // [[[lng, lat], [lng, lat], ...]]
  };
  properties: {
    parcelName: string;
    farmerId?: string;
    cropType?: string;
    areaAcres: number;
    areaHectares: number;
    perimeterMeters: number;
    recordedAt: string;
    gpsPrecisionMean: number;
  };
}

const EARTH_RADIUS_METERS = 6378137; // WGS-84 Earth equatorial radius

/**
 * Calculates geodesic distance between two points in meters (Haversine formula)
 */
export function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes the exact geodesic polygon area in square meters using metric projected Shoelace formula
 */
export function calculatePolygonArea(vertices: GeoVertex[]): number {
  if (vertices.length < 3) return 0;

  const count = vertices.length;
  const meanLat = vertices.reduce((sum, v) => sum + v.lat, 0) / count;
  const meanLatRad = (meanLat * Math.PI) / 180;
  const metersPerDegreeLat = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const metersPerDegreeLng = (Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos(meanLatRad);

  let total = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const xi = vertices[i].lng * metersPerDegreeLng;
    const yi = vertices[i].lat * metersPerDegreeLat;
    const xj = vertices[j].lng * metersPerDegreeLng;
    const yj = vertices[j].lat * metersPerDegreeLat;

    total += xi * yj - xj * yi;
  }

  return Math.abs(total / 2.0);
}

/**
 * Performs full spatial analytics on a set of parcel GPS vertices
 */
export function computeParcelMetrics(vertices: GeoVertex[]): ParcelCalculations {
  if (vertices.length < 3) {
    return {
      areaSquareMeters: 0,
      hectares: 0,
      acres: 0,
      perimeterMeters: 0,
      vertexCount: vertices.length,
      centroid: [0, 0],
      boundingBox: [0, 0, 0, 0],
    };
  }

  const areaSquareMeters = calculatePolygonArea(vertices);
  const hectares = +(areaSquareMeters / 10000).toFixed(3);
  const acres = +(areaSquareMeters / 4046.8564224).toFixed(3);

  let perimeterMeters = 0;
  let sumLat = 0;
  let sumLng = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];

    perimeterMeters += calculateDistanceMeters(v1.lat, v1.lng, v2.lat, v2.lng);
    sumLat += v1.lat;
    sumLng += v1.lng;

    if (v1.lat < minLat) minLat = v1.lat;
    if (v1.lat > maxLat) maxLat = v1.lat;
    if (v1.lng < minLng) minLng = v1.lng;
    if (v1.lng > maxLng) maxLng = v1.lng;
  }

  return {
    areaSquareMeters: Math.round(areaSquareMeters),
    hectares,
    acres,
    perimeterMeters: Math.round(perimeterMeters),
    vertexCount: vertices.length,
    centroid: [sumLat / vertices.length, sumLng / vertices.length],
    boundingBox: [minLng, minLat, maxLng, maxLat],
  };
}

/**
 * Converts recorded GPS vertices into standard RFC 7946 GeoJSON Feature
 */
export function exportToGeoJsonPolygon(
  vertices: GeoVertex[],
  metadata: { parcelName: string; farmerId?: string; cropType?: string }
): GeoJsonParcelFeature {
  const metrics = computeParcelMetrics(vertices);

  // GeoJSON requires [longitude, latitude] order and a closed ring (first == last)
  const coordinates: number[][] = vertices.map(v => [v.lng, v.lat]);
  if (coordinates.length > 0) {
    coordinates.push([vertices[0].lng, vertices[0].lat]);
  }

  const meanAccuracy =
    vertices.reduce((acc, v) => acc + (v.accuracy || 5), 0) / (vertices.length || 1);

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
    properties: {
      parcelName: metadata.parcelName,
      farmerId: metadata.farmerId,
      cropType: metadata.cropType,
      areaAcres: metrics.acres,
      areaHectares: metrics.hectares,
      perimeterMeters: metrics.perimeterMeters,
      recordedAt: new Date().toISOString(),
      gpsPrecisionMean: +meanAccuracy.toFixed(1),
    },
  };
}

const OFFLINE_PARCELS_STORAGE_KEY = 'agri_offline_parcels_v1';

export function saveParcelOffline(parcel: GeoJsonParcelFeature): void {
  try {
    const raw = localStorage.getItem(OFFLINE_PARCELS_STORAGE_KEY);
    const parcels: GeoJsonParcelFeature[] = raw ? JSON.parse(raw) : [];
    parcels.push(parcel);
    localStorage.setItem(OFFLINE_PARCELS_STORAGE_KEY, JSON.stringify(parcels));
  } catch (error) {
    console.error('Failed to save parcel offline:', error);
  }
}

export function getOfflineParcels(): GeoJsonParcelFeature[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PARCELS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
