import {
  areaUncertaintyHectares,
  boundaryMetrics,
  checkBoundary,
  distanceMetres,
  simplifyBoundary,
  type BoundaryMethod,
  type BoundaryMetrics,
  type BoundaryPoint,
  type BoundaryProblem,
} from '@ag-extension/shared/api';

/** A boundary as the field form holds it. */
export interface FieldBoundary {
  points: BoundaryPoint[];
  method: BoundaryMethod;
  /** Typical (median) GPS error of the walked points, in metres; null for a drawn boundary. */
  accuracyM: number | null;
}

/** GPS fixes less certain than this are skipped while walking. */
export const WALK_MAX_ACCURACY_M = 30;
/** A new point needs the walker to have moved at least this far. */
export const WALK_MIN_STEP_M = 3;

export interface WalkFix extends BoundaryPoint {
  accuracy: number;
}

export type WalkVerdict = 'accepted' | 'too_inaccurate' | 'too_close';

/** Whether a GPS fix taken while walking becomes the next boundary point. */
export function judgeWalkFix(points: BoundaryPoint[], fix: WalkFix): WalkVerdict {
  if (!Number.isFinite(fix.accuracy) || fix.accuracy > WALK_MAX_ACCURACY_M) return 'too_inaccurate';
  const last = points[points.length - 1];
  if (last && distanceMetres(last, fix) < Math.max(WALK_MIN_STEP_M, fix.accuracy / 2)) return 'too_close';
  return 'accepted';
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Tidies a finished walk: GPS wobble smaller than half the typical error is smoothed out, and a
 * last point back where the walk began is dropped, since the shape closes on its own.
 */
export function finishWalk(points: BoundaryPoint[], accuracyM: number | null): BoundaryPoint[] {
  const tolerance = (accuracyM ?? WALK_MIN_STEP_M) / 2;
  const tidy = simplifyBoundary(points, tolerance);
  const closesOnStart = tidy.length > 3 && distanceMetres(tidy[0], tidy[tidy.length - 1]) <= Math.max(accuracyM ?? 0, WALK_MIN_STEP_M);
  return closesOnStart ? tidy.slice(0, -1) : tidy;
}

export interface BoundarySummary {
  metrics: BoundaryMetrics;
  problem: BoundaryProblem | null;
  /** Upper bound on the area error of a walked boundary, in hectares. */
  uncertaintyHa: number | null;
}

export function summarizeBoundary(boundary: FieldBoundary): BoundarySummary {
  const check = checkBoundary(boundary.points);
  const metrics = check.ok ? check.metrics : boundaryMetrics(boundary.points);
  const uncertaintyHa = boundary.method === 'walked' && boundary.accuracyM ? areaUncertaintyHectares(metrics.perimeterM, boundary.accuracyM) : null;
  return { metrics, problem: check.ok ? null : check.problem, uncertaintyHa };
}

/** The boundary stored on a field, when it has a usable one. */
export function storedBoundary(field: { boundaryCoordinates?: unknown; boundaryMethod?: unknown; boundaryAccuracyM?: unknown }): FieldBoundary | null {
  const points = field.boundaryCoordinates;
  if (!Array.isArray(points) || points.length < 3) return null;
  const valid = points.every(p => p && typeof p === 'object' && Number.isFinite(Number((p as BoundaryPoint).lat)) && Number.isFinite(Number((p as BoundaryPoint).lng)));
  if (!valid) return null;
  return {
    points: points.map(p => ({ lat: Number((p as BoundaryPoint).lat), lng: Number((p as BoundaryPoint).lng) })),
    method: field.boundaryMethod === 'walked' ? 'walked' : 'drawn',
    accuracyM: field.boundaryAccuracyM === null || field.boundaryAccuracyM === undefined ? null : Number(field.boundaryAccuracyM),
  };
}

/** Side of the square an outline is drawn in. */
export const OUTLINE_SIZE = 100;
const PAD = 6;

/** The shape scaled into a square, keeping its proportions (east-west distances shrink away from the equator). */
export function outlinePath(points: BoundaryPoint[]): string {
  if (points.length < 3) return '';
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lngScale = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map(p => p.lng * lngScale);
  const ys = points.map(p => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const scale = (OUTLINE_SIZE - PAD * 2) / span;
  const offsetX = (OUTLINE_SIZE - (Math.max(...xs) - minX) * scale) / 2;
  const offsetY = (OUTLINE_SIZE - (Math.max(...ys) - minY) * scale) / 2;
  return `${xs.map((x, i) => `${i ? 'L' : 'M'}${((x - minX) * scale + offsetX).toFixed(1)} ${((ys[i] - minY) * scale + offsetY).toFixed(1)}`).join(' ')} Z`;
}
