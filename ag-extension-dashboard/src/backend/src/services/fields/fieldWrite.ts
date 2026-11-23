import { Prisma } from '@prisma/client';
import { checkBoundary, type BoundaryProblem } from '@/shared-api/fieldBoundary';
import type { UpdateField } from '@/shared-api/field';

const BOUNDARY_PROBLEM: Record<BoundaryProblem, string> = {
    too_few_points: 'A boundary needs at least three corners',
    crosses_itself: 'The boundary crosses itself; move or remove the corners where the lines cross',
    too_small: 'The boundary encloses almost no area',
    too_large: 'The boundary is far larger than one field',
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));

export type FieldColumns = Prisma.FieldUncheckedUpdateInput;
type ColumnsResult = { ok: true; data: FieldColumns } | { ok: false; error: string };

/** Columns for a new boundary: the shape itself, how it was mapped, and the area and middle it measures. */
function boundaryColumns(body: UpdateField & { boundaryCoordinates: NonNullable<UpdateField['boundaryCoordinates']> }): ColumnsResult {
    const check = checkBoundary(body.boundaryCoordinates);
    if (!check.ok) return { ok: false, error: BOUNDARY_PROBLEM[check.problem] };
    if (!body.boundaryMethod) return { ok: false, error: 'boundaryMethod is required with a boundary (walked or drawn)' };
    const walkedAccuracy = body.boundaryMethod === 'walked' && body.boundaryAccuracyM ? round(body.boundaryAccuracyM, 1) : null;
    return {
        ok: true,
        data: {
            boundaryCoordinates: body.boundaryCoordinates.map(p => ({ lat: round(p.lat, 7), lng: round(p.lng, 7) })),
            boundaryMethod: body.boundaryMethod,
            boundaryAccuracyM: walkedAccuracy,
            areaHectares: round(check.metrics.hectares, 4),
            latitude: round(check.metrics.centroid.lat, 6),
            longitude: round(check.metrics.centroid.lng, 6),
        },
    };
}

/** The area and location a person typed, kept only when no boundary decides them. */
function typedPlacement(body: UpdateField): FieldColumns {
    const data: FieldColumns = {};
    if (body.areaHectares !== undefined) data.areaHectares = body.areaHectares;
    if (body.latitude !== undefined) data.latitude = body.latitude;
    if (body.longitude !== undefined) data.longitude = body.longitude;
    return data;
}

/**
 * The columns a field write sets. A boundary decides the area and the location: its measured
 * area and middle replace whatever area and coordinates came with it, and while a field keeps
 * a boundary, an area or location sent on its own is ignored. `boundaryCoordinates: null`
 * removes the boundary and keeps the last measured area unless a new one is sent.
 */
export function fieldColumnsFromWrite(body: UpdateField, hasStoredBoundary = false): ColumnsResult {
    const data: FieldColumns = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.soilType !== undefined) data.soilType = body.soilType;
    if (body.soilPh !== undefined) data.soilPh = body.soilPh;

    const points = body.boundaryCoordinates;
    if (points) {
        const boundary = boundaryColumns({ ...body, boundaryCoordinates: points });
        return boundary.ok ? { ok: true, data: { ...data, ...boundary.data } } : boundary;
    }
    if (points === null) {
        return { ok: true, data: { ...data, ...typedPlacement(body), boundaryCoordinates: Prisma.DbNull, boundaryMethod: null, boundaryAccuracyM: null } };
    }
    return { ok: true, data: hasStoredBoundary ? data : { ...data, ...typedPlacement(body) } };
}
