/**
 * Field boundaries: the shape a person maps by walking a field's edge with a phone or by
 * tapping its corners on a map. This is the one implementation of the geometry. The app uses
 * it to show the area while someone maps, and the API uses it to work out the area it stores,
 * so the two can never disagree.
 *
 * Fields are small enough (well under a few kilometres across) that a flat projection around
 * the field's middle is accurate to far better than any phone GPS fix.
 */
import { z } from 'zod';

export const MAX_BOUNDARY_POINTS = 500;
/** Smaller than this is a mis-tap, not a field. */
export const MIN_BOUNDARY_AREA_M2 = 4;
/** Larger than this is a mistake on the map, not one field (10,000 ha). */
export const MAX_BOUNDARY_AREA_M2 = 100_000_000;

export const boundaryPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** walked: GPS fixes taken while walking the edge. drawn: corners tapped on a map. */
export const boundaryMethodSchema = z.enum(['walked', 'drawn']);

export const boundaryPointsSchema = z.array(boundaryPointSchema).min(3).max(MAX_BOUNDARY_POINTS);

export type BoundaryPoint = z.infer<typeof boundaryPointSchema>;
export type BoundaryMethod = z.infer<typeof boundaryMethodSchema>;

export interface BoundaryMetrics {
  areaM2: number;
  hectares: number;
  perimeterM: number;
  /** The middle of the shape (area-weighted), used as the field's location. */
  centroid: BoundaryPoint;
}

export type BoundaryProblem = 'too_few_points' | 'crosses_itself' | 'too_small' | 'too_large';

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

interface Projected {
  x: number;
  y: number;
}

/** Metres east and north of `origin`. */
function projector(origin: BoundaryPoint) {
  const metresPerDegLat = toRad(1) * EARTH_RADIUS_M;
  const metresPerDegLng = metresPerDegLat * Math.cos(toRad(origin.lat));
  return {
    to: (p: BoundaryPoint): Projected => ({ x: (p.lng - origin.lng) * metresPerDegLng, y: (p.lat - origin.lat) * metresPerDegLat }),
    from: (p: Projected): BoundaryPoint => ({ lat: origin.lat + p.y / metresPerDegLat, lng: origin.lng + p.x / metresPerDegLng }),
  };
}

function meanPoint(points: BoundaryPoint[]): BoundaryPoint {
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** Great-circle distance in metres. */
export function distanceMetres(a: BoundaryPoint, b: BoundaryPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Area, perimeter and middle of a closed shape (the last point joins back to the first). */
export function boundaryMetrics(points: BoundaryPoint[]): BoundaryMetrics {
  if (points.length < 3) {
    return { areaM2: 0, hectares: 0, perimeterM: 0, centroid: points.length ? meanPoint(points) : { lat: 0, lng: 0 } };
  }
  const projection = projector(meanPoint(points));
  const xy = points.map(projection.to);
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  let perimeterM = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    const cross = xy[i].x * xy[j].y - xy[j].x * xy[i].y;
    twiceArea += cross;
    cx += (xy[i].x + xy[j].x) * cross;
    cy += (xy[i].y + xy[j].y) * cross;
    perimeterM += distanceMetres(points[i], points[j]);
  }
  const areaM2 = Math.abs(twiceArea) / 2;
  const centroid = twiceArea === 0 ? meanPoint(points) : projection.from({ x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) });
  return { areaM2, hectares: areaM2 / 10_000, perimeterM, centroid };
}

function orientation(a: Projected, b: Projected, c: Projected): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  return Math.abs(value) < 1e-9 ? 0 : value > 0 ? 1 : 2;
}

function onSegment(a: Projected, b: Projected, c: Projected): boolean {
  return b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);
}

function segmentsCross(p1: Projected, q1: Projected, p2: Projected, q2: Projected): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(p1, p2, q1)) || (o2 === 0 && onSegment(p1, q2, q1)) || (o3 === 0 && onSegment(p2, p1, q2)) || (o4 === 0 && onSegment(p2, q1, q2));
}

/** True when two edges that do not share a corner touch or cross, as in a figure of eight. */
export function boundaryCrossesItself(points: BoundaryPoint[]): boolean {
  if (points.length < 4) return false;
  const projection = projector(meanPoint(points));
  const xy = points.map(projection.to);
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // these two edges share the first corner
      if (segmentsCross(xy[i], xy[(i + 1) % n], xy[j], xy[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * How far off the area could be, in hectares: a band as wide as the GPS error running all the
 * way round the edge. It is an upper bound; errors partly cancel on a long walk.
 */
export function areaUncertaintyHectares(perimeterM: number, accuracyM: number): number {
  return (perimeterM * accuracyM) / 10_000;
}

/** Checks a shape is a usable field, and gives its measurements when it is. */
export function checkBoundary(points: BoundaryPoint[]): { ok: true; metrics: BoundaryMetrics } | { ok: false; problem: BoundaryProblem } {
  if (points.length < 3) return { ok: false, problem: 'too_few_points' };
  if (boundaryCrossesItself(points)) return { ok: false, problem: 'crosses_itself' };
  const metrics = boundaryMetrics(points);
  if (metrics.areaM2 < MIN_BOUNDARY_AREA_M2) return { ok: false, problem: 'too_small' };
  if (metrics.areaM2 > MAX_BOUNDARY_AREA_M2) return { ok: false, problem: 'too_large' };
  return { ok: true, metrics };
}

/**
 * Drops points that lie within `toleranceM` of the line between their neighbours (Douglas-Peucker),
 * so GPS wobble while someone stands still does not become a zig-zag in the boundary.
 */
export function simplifyBoundary(points: BoundaryPoint[], toleranceM: number): BoundaryPoint[] {
  if (points.length <= 3 || toleranceM <= 0) return points;
  const projection = projector(meanPoint(points));
  const xy = points.map(projection.to);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = xy[start];
    const b = xy[end];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let farthest = -1;
    let farthestDistance = 0;
    for (let i = start + 1; i < end; i++) {
      const p = xy[i];
      const distance = length === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
      if (distance > farthestDistance) {
        farthest = i;
        farthestDistance = distance;
      }
    }
    if (farthest !== -1 && farthestDistance > toleranceM) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  const kept = points.filter((_, i) => keep[i]);
  return kept.length >= 3 ? kept : points;
}
