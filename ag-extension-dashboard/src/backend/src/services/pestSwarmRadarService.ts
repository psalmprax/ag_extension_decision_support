/**
 * Pest sighting clustering for the WorldMonitor pest layer (GET /api/worldmonitor/layers).
 * A heuristic neighbor-merge, not full DBSCAN: sightings within epsilon kilometres of
 * each other form a cluster, and its level follows the densest sighting in it.
 */
import { logger } from '../utils/logger';

export interface PestSightingReport {
  id: string;
  pestType: 'desert_locust' | 'fall_armyworm' | 'quelea_birds' | 'african_armyworm';
  lat: number;
  lng: number;
  county: string;
  severity: 'isolated' | 'moderate_swarm' | 'dense_plague';
  reportedAt: string;
  reporterRole: 'farmer' | 'extension_officer';
}

export interface SwarmCluster {
  clusterId: string;
  pestType: string;
  centroid: [number, number];
  sightingCount: number;
  radiusKm: number;
  severityLevel: 'moderate' | 'high' | 'critical';
  /** Counties of the sightings in this cluster, when the caller supplies them. */
  counties?: string[];
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function clusterPestSightings(
  sightings: PestSightingReport[],
  epsilonKm: number = 30.0
): SwarmCluster[] {
  // Heuristic neighbor-merge clustering (not full DBSCAN) — intentionally simple for extension use
  logger.info(`Clustering ${sightings.length} pest sightings (epsilon=${epsilonKm}km)`);

  if (sightings.length === 0) return [];

  const clusters: SwarmCluster[] = [];
  const visited = new Set<string>();

  for (const s of sightings) {
    if (visited.has(s.id)) continue;
    visited.add(s.id);

    const neighbors = sightings.filter(other => distanceKm(s.lat, s.lng, other.lat, other.lng) <= epsilonKm);

    if (neighbors.length >= 2) {
      neighbors.forEach(n => visited.add(n.id));

      const meanLat = neighbors.reduce((acc, val) => acc + val.lat, 0) / neighbors.length;
      const meanLng = neighbors.reduce((acc, val) => acc + val.lng, 0) / neighbors.length;

      const hasCritical = neighbors.some(n => n.severity === 'dense_plague');
      const hasModerate = neighbors.some(n => n.severity === 'moderate_swarm');

      clusters.push({
        clusterId: `cluster_${s.pestType}_${Date.now()}_${clusters.length + 1}`,
        pestType: s.pestType,
        centroid: [+meanLat.toFixed(4), +meanLng.toFixed(4)],
        sightingCount: neighbors.length,
        radiusKm: epsilonKm,
        severityLevel: hasCritical ? 'critical' : hasModerate ? 'high' : 'moderate',
        counties: Array.from(new Set(neighbors.map(n => n.county).filter(Boolean))),
      });
    }
  }

  return clusters;
}
