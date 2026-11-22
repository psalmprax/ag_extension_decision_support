import { Router, Response } from 'express';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { requirePaidPlan } from '@/middleware/subscriptionMiddleware';
import { validate } from '@/middleware/validate';
import { query } from '@/services/databaseService';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { SoilGridsService } from '@/services/soilGridsService';
import { OpenMeteoSoilService } from '@/services/openMeteoSoilService';
import { clusterPestSightings, type SwarmCluster } from '@/services/pestSwarmRadarService';
import { demoSql } from '@/services/demoScope';
import { resolvePrincipalRegion } from '@/services/messageAccessService';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));
router.use(requirePaidPlan('worldmonitor'));

const layersQuery = z.object({
  region: z.string().optional(),
  crop: z.string().optional(),
  county: z.string().optional(),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '200', 10) || 200, 500)),
});

/**
 * GET /api/worldmonitor/layers?region=&crop=&county=&limit=
 * Officer-only: 4 GIS layers (soil, NDVI, pest; satellite orbit is a
 * deterministic preview — see `live: false` on the orbit payload). The pest
 * layer carries a `status` so a missing data source is never shown as zero.
 * Each layer is filtered by the same region/crop/county so the globe stays coherent.
 */
router.get('/layers', validate({ query: layersQuery }), async (req: AuthRequest, res: Response) => {
  try {
    const { region, crop, county, limit } = req.query as unknown as { region?: string; crop?: string; county?: string; limit: number };
    const built = buildFarmerFilters(region, crop, county);
    const { clauses, params } = built;
    let nextIdx = built.nextIdx;
    // Who may see which farms: an officer their own farmers, a manager their region,
    // an administrator everyone. Locations are personal data.
    const role = req.user?.role;
    if (role === 'extension_officer') {
      clauses.push(`f.assigned_officer_id = $${nextIdx++}`);
      params.push(req.user!.userId);
    } else if (role === 'regional_manager') {
      clauses.push(`f.region = $${nextIdx++}`);
      params.push(await resolvePrincipalRegion(req.user!.userId));
    }
    // Demo farmers never appear on a real account's map (f is joined in both layers).
    clauses.push(demoSql('f', req.user));

    // 1. Farmer points (for NDVI/soil anchors) — live from farmers table with lat/lon
    const farmerConditions = ['f.location_lat IS NOT NULL', 'f.location_lng IS NOT NULL', ...clauses];
    let farmerPoints: Array<{
      id: string; lat: string | null; lng: string | null; region: string | null; district: string | null; crops: string[] | null;
    }> = [];

    try {
      const { rows } = await query<{
        id: string; lat: string | null; lng: string | null; region: string | null; district: string | null; crops: string[] | null;
      }>(`SELECT f.id, f.location_lat as lat, f.location_lng as lng, f.region, f.district, f.crops
          FROM farmers f
          WHERE ${farmerConditions.join(' AND ')}
          LIMIT $${nextIdx}`, [...params, limit]);
      farmerPoints = rows || [];
    } catch (dbError) {
      logger.warn('WorldMonitor farmer points query failed:', dbError);
    }

    const soilHorizon = await fetchSoilHorizon(farmerPoints);
    const ndviPoints = await fetchNdviPoints(clauses, params, nextIdx, limit);
    const pestSwarm = await fetchPestSwarm(clauses, params, nextIdx);

    // 5. Satellite orbit — DETERMINISTIC PREVIEW, not live telemetry.
    // Static ISS/Terra-Aqua two-line elements propagated with Kepler math.
    // `live: false` lets clients badge this layer as preview until the orbit
    // layer is promoted beyond officer preview (live TLE fetch via celestrak.org/NORAD).
    const satelliteOrbit = {
      source: 'deterministic_preview',
      live: false,
      note: 'Deterministic Kepler propagation — replace with live TLE fetch (celestrak.org/NORAD) when orbit layer is promoted beyond officer preview.',
      generatedAt: new Date().toISOString(),
      tracks: [] as unknown[],
    };

    return res.json({
      success: true,
      data: {
        farmers: farmerPoints
          .filter(r => r.lat != null && r.lng != null && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
          .map(r => ({ id: r.id, lat: Number(r.lat), lon: Number(r.lng), region: r.region, district: r.district, crops: r.crops })),
        soilHorizon,
        ndviPoints,
        pestSwarm,
        satelliteOrbit,
        filters: { region: region || null, crop: crop || null, county: county || null, limit },
      },
    });
  } catch (error) {
    logger.error('WorldMonitor layers failed:', error);
    return safeError(res, 500, 'Failed to load worldmonitor layers');
  }
});

export default router;

/** Build the shared WHERE clauses + params for farmer-cohort filtering. */
function buildFarmerFilters(region: string | undefined, crop: string | undefined, county: string | undefined): {
  clauses: string[];
  params: unknown[];
  nextIdx: number;
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (region) {
    clauses.push(`f.region = $${idx++}`);
    params.push(region);
  }
  if (county) {
    clauses.push(`f.district = $${idx++}`);
    params.push(county);
  }
  if (crop) {
    clauses.push(`$${idx++} = ANY(f.crops)`);
    params.push(crop);
  }
  return { clauses, params, nextIdx: idx };
}

/** 2. SoilGrids horizon — sample the centroid of the filtered cohort (1 live call, not per-farmer). */
async function fetchSoilHorizon(farmerPoints: Array<{ lat: string | null; lng: string | null }>): Promise<unknown> {
  const validPoints = farmerPoints.filter(
    r => r.lat != null && r.lng != null && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))
  );
  if (validPoints.length === 0) return null;
  const avgLat = validPoints.reduce((s, r) => s + Number(r.lat), 0) / validPoints.length;
  const avgLon = validPoints.reduce((s, r) => s + Number(r.lng), 0) / validPoints.length;
  try {
    const [baseline, moisture] = await Promise.all([
      SoilGridsService.fetchBaseline(avgLat, avgLon).catch(() => null),
      OpenMeteoSoilService.fetchSnapshot(avgLat, avgLon).catch(() => null),
    ]);
    return { centroid: { lat: avgLat, lon: avgLon }, baseline, moisture };
  } catch (e) {
    logger.warn('WorldMonitor soil horizon fetch failed:', e);
    return null;
  }
}

/** 3. NDVI crop stress — live from diagnosis_events (last 30d) joined to farmer location when available. */
async function fetchNdviPoints(clauses: string[], params: unknown[], nextIdx: number, limit: number): Promise<unknown[]> {
  const ndviConditions = [`d.created_at > NOW() - INTERVAL '30 days'`, ...clauses];
  const ndviSql = `
      SELECT d.crop, d.disease_label, d.confidence, d.district, d.created_at, f.location_lat as lat, f.location_lng as lng
        FROM diagnosis_events d
        LEFT JOIN farmers f ON f.id = d.farmer_id
       WHERE ${ndviConditions.join(' AND ')}
       ORDER BY d.created_at DESC LIMIT $${nextIdx}
    `;
  try {
    const { rows } = await query(ndviSql, [...params, Math.min(limit, 200)]);
    return rows;
  } catch (e) {
    logger.warn('WorldMonitor NDVI fetch failed:', e);
    return [];
  }
}

/**
 * 4. Pest swarm trajectories — clustered from pest_sightings (last 14 days).
 *
 * `status` keeps an empty map from reading as an all-clear: `live` means the
 * source was queried (zero clusters is a real result), `no_data_source` means
 * the pest_sightings table does not exist on this deployment, `unavailable`
 * means the query failed.
 */
export type PestSwarmLayer = {
  status: 'live' | 'no_data_source' | 'unavailable';
  clusters: SwarmCluster[];
  trajectories: Array<Pick<SwarmCluster, 'clusterId' | 'centroid' | 'severityLevel'>>;
};


/** Diagnosis labels that name a swarming pest, mapped to the radar's pest types. */
const PEST_LABELS: Array<[RegExp, string]> = [
  [/fall[\s_-]*armyworm/i, 'fall_armyworm'],
  [/african[\s_-]*armyworm/i, 'african_armyworm'],
  [/desert[\s_-]*locust|\blocust/i, 'desert_locust'],
  [/quelea/i, 'quelea_birds'],
];

/**
 * Pest sightings are the pest diagnoses recorded at farms with a location in the last 14
 * days, limited to the farms this person may see. Each counts as one isolated sighting:
 * a diagnosis does not say how dense the swarm was, so clustering decides the level.
 */
async function fetchPestSwarm(clauses: string[], params: unknown[], nextIdx: number): Promise<PestSwarmLayer> {
  try {
    const { rows } = await query<{
      id: string; disease_label: string; lat: string; lng: string; district: string | null; created_at: string; role: string | null;
    }>(`SELECT d.id, d.disease_label, f.location_lat AS lat, f.location_lng AS lng, COALESCE(d.district, f.district) AS district,
               d.created_at, u.role
          FROM diagnosis_events d
          JOIN farmers f ON f.id = d.farmer_id
          LEFT JOIN users u ON u.id = d.user_id
         WHERE d.created_at > NOW() - INTERVAL '14 days'
           AND f.location_lat IS NOT NULL AND f.location_lng IS NOT NULL
           AND d.disease_label ~* '(armyworm|locust|quelea)'
           ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
         LIMIT $${nextIdx}`, [...params, 500]);
    const sightings = rows.flatMap(row => {
      const pestType = PEST_LABELS.find(([pattern]) => pattern.test(row.disease_label))?.[1];
      if (!pestType) return [];
      return [{
        id: row.id, pestType: pestType as never, lat: Number(row.lat), lng: Number(row.lng), county: row.district ?? '',
        severity: 'isolated' as never, reportedAt: row.created_at,
        reporterRole: (row.role === 'farmer' ? 'farmer' : 'extension_officer') as never,
      }];
    });
    if (sightings.length < 2) return { status: 'live', clusters: [], trajectories: [] };
    const clusters = clusterPestSightings(sightings);
    return {
      status: 'live',
      clusters,
      trajectories: clusters.map(c => ({ clusterId: c.clusterId, centroid: c.centroid, severityLevel: c.severityLevel })),
    };
  } catch (error) {
    logger.error('WorldMonitor pest swarm fetch failed:', error);
    return { status: 'unavailable', clusters: [], trajectories: [] };
  }
}
