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
}

export interface SwarmTrajectoryForecast {
  cluster: SwarmCluster;
  windSpeedKmh: number;
  windDirectionDegrees: number; // 0 = North, 90 = East, 180 = South, 270 = West
  forecast24hCentroid: [number, number];
  forecast48hCentroid: [number, number];
  predictedImpactCounties: string[];
  recommendedUrgentActions: string[];
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
      });
    }
  }

  return clusters;
}

export function forecastSwarmTrajectory(params: {
  cluster: SwarmCluster;
  windSpeedKmh: number;
  windDirectionDegrees: number; // e.g. 45 degrees (North-East)
}): SwarmTrajectoryForecast {
  const { cluster, windSpeedKmh, windDirectionDegrees } = params;

  logger.info(`Forecasting trajectory for swarm ${cluster.clusterId} with wind ${windSpeedKmh}km/h at ${windDirectionDegrees}°`);

  // Active swarm flies approx 60% of wind speed
  const flightSpeedKmh = windSpeedKmh * 0.6;
  const windRad = (windDirectionDegrees * Math.PI) / 180;

  // 1 degree latitude ~ 111 km; 1 degree longitude ~ 111 * cos(lat) km
  const lat = cluster.centroid[0];
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos((lat * Math.PI) / 180);

  // 24h displacement (assuming 8 hours flight window per day)
  const dist24h = flightSpeedKmh * 8;
  const deltaLat24 = (dist24h * Math.cos(windRad)) / kmPerDegLat;
  const deltaLng24 = (dist24h * Math.sin(windRad)) / kmPerDegLng;

  const lat24 = +(cluster.centroid[0] + deltaLat24).toFixed(4);
  const lng24 = +(cluster.centroid[1] + deltaLng24).toFixed(4);

  // 48h displacement
  const lat48 = +(cluster.centroid[0] + deltaLat24 * 2).toFixed(4);
  const lng48 = +(cluster.centroid[1] + deltaLng24 * 2).toFixed(4);

  // DEMO: county list is illustrative; real trajectory would intersect admin boundaries
  return {
    cluster,
    windSpeedKmh,
    windDirectionDegrees,
    forecast24hCentroid: [lat24, lng24],
    forecast48hCentroid: [lat48, lng48],
    predictedImpactCounties: ['Nakuru', 'Baringo', 'Laikipia'],
    recommendedUrgentActions: [
      '[DEMO] Issue 24h advisory (requires dispatch integration) to farmers in predicted corridor',
      '[DEMO] Pre-position biopesticide — verify stock before mobilizing',
      '[DEMO] Notify phytosanitary teams — requires ministry integration',
    ],
  };
}
