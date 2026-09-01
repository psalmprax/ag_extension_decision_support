import { describe, it, expect } from 'vitest';
import {
  calculateDistanceMeters,
  calculatePolygonArea,
  computeParcelMetrics,
  exportToGeoJsonPolygon,
  type GeoVertex,
} from '../services/parcelGeoService';

describe('ParcelGeoService (Geodesic Field Boundary Tracing & Area Calculations)', () => {
  it('calculates distance between two known coordinates (e.g. Nairobi to Nakuru)', () => {
    // Nairobi: -1.286389, 36.817223 | Nakuru: -0.303099, 36.080025 (~140 km)
    const distance = calculateDistanceMeters(-1.286389, 36.817223, -0.303099, 36.080025);
    expect(distance).toBeGreaterThan(130000);
    expect(distance).toBeLessThan(160000);
  });

  it('calculates polygon area for a ~1 hectare test plot', () => {
    // 100m x 100m square near equator
    // 1 degree latitude ~ 111,320m -> 100m ~ 0.0008983 degrees
    const delta = 0.0008983;
    const baseLat = -0.3;
    const baseLng = 36.0;

    const vertices: GeoVertex[] = [
      { lat: baseLat, lng: baseLng, timestamp: '2026-09-01T00:00:00Z' },
      { lat: baseLat + delta, lng: baseLng, timestamp: '2026-09-01T00:01:00Z' },
      { lat: baseLat + delta, lng: baseLng + delta, timestamp: '2026-09-01T00:02:00Z' },
      { lat: baseLat, lng: baseLng + delta, timestamp: '2026-09-01T00:03:00Z' },
    ];

    const area = calculatePolygonArea(vertices);
    // Should be approximately 10,000 m² (1 hectare +/- 5%)
    expect(area).toBeGreaterThan(9000);
    expect(area).toBeLessThan(11000);

    const metrics = computeParcelMetrics(vertices);
    expect(metrics.hectares).toBeGreaterThanOrEqual(0.9);
    expect(metrics.hectares).toBeLessThanOrEqual(1.1);
    expect(metrics.acres).toBeGreaterThan(2.0);
    expect(metrics.acres).toBeLessThan(2.7);
    expect(metrics.vertexCount).toBe(4);
  });

  it('exports valid standard GeoJSON feature with closed ring', () => {
    const vertices: GeoVertex[] = [
      { lat: -0.3, lng: 36.0, accuracy: 2.5, timestamp: '2026-09-01T00:00:00Z' },
      { lat: -0.301, lng: 36.0, accuracy: 3.0, timestamp: '2026-09-01T00:01:00Z' },
      { lat: -0.301, lng: 36.001, accuracy: 2.8, timestamp: '2026-09-01T00:02:00Z' },
    ];

    const geoJson = exportToGeoJsonPolygon(vertices, {
      parcelName: 'North Maize Block A',
      farmerId: 'farmer-123',
      cropType: 'Maize',
    });

    expect(geoJson.type).toBe('Feature');
    expect(geoJson.geometry.type).toBe('Polygon');
    expect(geoJson.properties.parcelName).toBe('North Maize Block A');
    expect(geoJson.properties.cropType).toBe('Maize');
    // First coordinate must equal last coordinate for valid GeoJSON Polygon
    const ring = geoJson.geometry.coordinates[0];
    expect(ring.length).toBe(4);
    expect(ring[0]).toEqual(ring[3]);
  });
});
