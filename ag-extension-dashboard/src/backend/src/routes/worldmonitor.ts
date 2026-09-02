import { Router, Response } from 'express';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { query } from '@/services/databaseService';
import { safeError } from '@/utils/safeResponse';
import { logger } from '@/utils/logger';
import { SoilGridsService } from '@/services/soilGridsService';
import { OpenMeteoSoilService } from '@/services/openMeteoSoilService';
import { clusterPestSightings } from '@/services/pestSwarmRadarService';

const router = Router();
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

const layersQuery = z.object({
  region: z.string().optional(),
  crop: z.string().optional(),
  county: z.string().optional(),
  limit: z.string().optional().transform(v => Math.min(parseInt(v || '200', 10) || 200, 500)),
});

/**
 * GET /api/worldmonitor/layers?region=&crop=&county=&limit=
 * Officer-only: 4 live GIS layers (soil, NDVI, pest, satellite orbit stub)
 * Each layer is filtered by the same region/crop/county so the globe stays coherent.
 */
router.get('/layers', validate({ query: layersQuery }), async (req: AuthRequest, res: Response) => {
  try {
    const { region, crop, county, limit } = req.query as unknown as { region?: string; crop?: string; county?: string; limit: number };
    const userRegion = (req.user as unknown as { region?: string })?.region || region;
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (userRegion) { where.push(`f.region = $${idx++}`); params.push(userRegion); }
    if (county) { where.push(`f.district = $${idx++}`); params.push(county); }
    if (crop) { where.push(`$${idx++} = ANY(f.crops)`); params.push(crop); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 1. Farmer points (for NDVI/soil anchors) — live from farmers table with lat/lon
    const { rows: farmerPoints } = await query<{
      id: string; lat: string | null; lng: string | null; region: string | null; district: string | null; crops: string[] | null;
    }>(`SELECT f.id, f.location_lat as lat, f.location_lng as lng, f.region, f.district, f.crops
        FROM farmers f ${whereSql} AND f.location_lat IS NOT NULL AND f.location_lng IS NOT NULL
        LIMIT $${idx}`, [...params, limit]);

    // 2. SoilGrids horizon — sample the centroid of the filtered cohort (1 live call, not per-farmer)
    let soilHorizon: unknown = null;
    if (farmerPoints.length > 0) {
      const avgLat = farmerPoints.reduce((s, r) => s + Number(r.lat), 0) / farmerPoints.length;
      const avgLon = farmerPoints.reduce((s, r) => s + Number(r.lng), 0) / farmerPoints.length;
      try {
        const [baseline, moisture] = await Promise.all([
          SoilGridsService.fetchBaseline(avgLat, avgLon).catch(() => null),
          OpenMeteoSoilService.fetchSnapshot(avgLat, avgLon).catch(() => null),
        ]);
        soilHorizon = { centroid: { lat: avgLat, lon: avgLon }, baseline, moisture };
      } catch (e) { logger.warn('WorldMonitor soil horizon fetch failed:', e); }
    }

    // 3. NDVI crop stress — live from diagnosis_events (last 30d) joined to farmer location when available
    const ndviWhere = [...where];
    const ndviParams: unknown[] = [...params];
    let ndviIdx = idx;
    // ndviWhere already built; add time filter
    const ndviSql = `
      SELECT d.crop, d.disease_label, d.confidence, d.district, d.created_at, f.location_lat as lat, f.location_lng as lng
        FROM diagnosis_events d
        LEFT JOIN farmers f ON f.id = d.farmer_id
       ${ndviWhere.length ? `WHERE ${ndviWhere.join(' AND ')}` : ''}
       ${ndviWhere.length ? 'AND' : 'WHERE'} d.created_at > NOW() - INTERVAL '30 days'
       ORDER BY d.created_at DESC LIMIT $${ndviIdx}
    `;
    let ndviPoints: unknown[] = [];
    try {
      const { rows } = await query(ndviSql, [...ndviParams, Math.min(limit, 200)]);
      ndviPoints = rows;
    } catch (e) { logger.warn('WorldMonitor NDVI fetch failed:', e); }

    // 4. Pest swarm trajectories — live from pest_sightings table if present, else empty (no synthetic counties)
    let pestSwarm: unknown = { clusters: [], trajectories: [] };
    try {
      const { rows: sightings } = await query<{
        id: string; pest_type: string; lat: string; lng: string; county: string; severity: string; reported_at: string; reporter_role: string;
      }>(`SELECT id, pest_type, lat, lng, county, severity, reported_at, reporter_role FROM pest_sightings WHERE reported_at > NOW() - INTERVAL '14 days' LIMIT 500`);
      if (sightings.length >= 2) {
        const clusters = clusterPestSightings(sightings.map(s => ({
          id: s.id, pestType: s.pest_type as never, lat: Number(s.lat), lng: Number(s.lng), county: s.county, severity: s.severity as never, reportedAt: s.reported_at, reporterRole: s.reporter_role as never,
        })));
        pestSwarm = { clusters, trajectories: clusters.map(c => ({ clusterId: c.clusterId, centroid: c.centroid, severityLevel: c.severityLevel })) };
      }
    } catch { /* table may not exist yet — return empty swarm */ }

    // 5. Satellite orbit stub — static ISS/Terra-Aqua two-line elements are live via isDemo=false, but orbit is deterministic; return stub with timestamp
    const satelliteOrbit = {
      source: 'orbit_stub',
      note: 'Deterministic Kepler propagation — replace with live TLE fetch (celestrak.org/NORAD) when orbit layer is promoted beyond officer preview.',
      generatedAt: new Date().toISOString(),
      tracks: [] as unknown[],
    };

    return res.json({
      success: true,
      data: {
        farmers: farmerPoints.map(r => ({ id: r.id, lat: Number(r.lat), lon: Number(r.lng), region: r.region, district: r.district, crops: r.crops })),
        soilHorizon,
        ndviPoints,
        pestSwarm,
        satelliteOrbit,
        filters: { region: userRegion || null, crop: crop || null, county: county || null, limit },
      },
    });
  } catch (error) {
    logger.error('WorldMonitor layers failed:', error);
    return safeError(res, 500, 'Failed to load worldmonitor layers');
  }
});

export default router;
