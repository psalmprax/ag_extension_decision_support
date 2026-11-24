import {
    areaUncertaintyHectares,
    boundaryCrossesItself,
    boundaryMetrics,
    checkBoundary,
    simplifyBoundary,
    type BoundaryPoint,
} from '@/shared-api/fieldBoundary';
import { fieldColumnsFromWrite } from '@/services/fields/fieldWrite';

// A square about 100 m a side near Nakuru: one hectare.
const METRE_LAT = 1 / 111_195;
const lat0 = -0.3031;
const lng0 = 36.08;
const metreLng = METRE_LAT / Math.cos((lat0 * Math.PI) / 180);
const at = (eastM: number, northM: number): BoundaryPoint => ({ lat: lat0 + northM * METRE_LAT, lng: lng0 + eastM * metreLng });
const SQUARE = [at(0, 0), at(100, 0), at(100, 100), at(0, 100)];

describe('field boundary geometry', () => {
    it('measures a 100 m square as one hectare with a 400 m edge', () => {
        const metrics = boundaryMetrics(SQUARE);
        expect(metrics.hectares).toBeCloseTo(1, 2);
        expect(metrics.perimeterM).toBeCloseTo(400, 0);
    });

    it('puts the middle of an L-shaped field inside its area, not at the average corner', () => {
        const l = [at(0, 0), at(100, 0), at(100, 20), at(20, 20), at(20, 100), at(0, 100)];
        const { centroid, hectares } = boundaryMetrics(l);
        expect(hectares).toBeCloseTo(0.36, 2);
        // Area-weighted middle of this L: (2000 m² × 10 m + 1600 m² × 60 m) / 3600 m² = 32.2 m north.
        expect((centroid.lat - lat0) / METRE_LAT).toBeCloseTo(32.2, 1);
    });

    it('gives the same area whichever way round the corners go', () => {
        expect(boundaryMetrics([...SQUARE].reverse()).areaM2).toBeCloseTo(boundaryMetrics(SQUARE).areaM2, 6);
    });

    it('spots a figure of eight', () => {
        expect(boundaryCrossesItself([at(0, 0), at(100, 100), at(100, 0), at(0, 100)])).toBe(true);
        expect(boundaryCrossesItself(SQUARE)).toBe(false);
    });

    it('turns down shapes that are not a usable field', () => {
        expect(checkBoundary(SQUARE.slice(0, 2))).toEqual({ ok: false, problem: 'too_few_points' });
        expect(checkBoundary([at(0, 0), at(100, 100), at(100, 0), at(0, 100)])).toEqual({ ok: false, problem: 'crosses_itself' });
        expect(checkBoundary([at(0, 0), at(1, 0), at(1, 1)])).toEqual({ ok: false, problem: 'too_small' });
        expect(checkBoundary([{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }])).toEqual({ ok: false, problem: 'too_large' });
    });

    it('drops GPS wobble along a straight edge but keeps the corners', () => {
        const walked = [at(0, 0), at(25, 1), at(50, -1), at(75, 1), at(100, 0), at(100, 50), at(100, 100), at(0, 100)];
        const simplified = simplifyBoundary(walked, 3);
        expect(simplified).toEqual([at(0, 0), at(100, 0), at(100, 100), at(0, 100)]);
    });

    it('bounds the area error by the edge length times the GPS error', () => {
        expect(areaUncertaintyHectares(400, 5)).toBeCloseTo(0.2, 6);
    });
});

describe('fieldColumnsFromWrite', () => {
    it('takes the area and location from a boundary, not from the numbers sent with it', () => {
        const result = fieldColumnsFromWrite({ areaHectares: 7, latitude: 1, longitude: 1, boundaryCoordinates: SQUARE, boundaryMethod: 'walked', boundaryAccuracyM: 4.24 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.areaHectares).toBeCloseTo(1, 2);
        expect(result.data.latitude).toBeCloseTo(lat0 + 50 * METRE_LAT, 5);
        expect(result.data.boundaryMethod).toBe('walked');
        expect(result.data.boundaryAccuracyM).toBe(4.2);
    });

    it('keeps no GPS error for a boundary drawn on a map', () => {
        const result = fieldColumnsFromWrite({ boundaryCoordinates: SQUARE, boundaryMethod: 'drawn', boundaryAccuracyM: 8 });
        expect(result.ok && result.data.boundaryAccuracyM).toBeNull();
    });

    it('needs to know how a boundary was mapped', () => {
        expect(fieldColumnsFromWrite({ boundaryCoordinates: SQUARE })).toEqual({ ok: false, error: expect.stringMatching(/boundaryMethod/) });
    });

    it('explains a boundary that crosses itself', () => {
        const result = fieldColumnsFromWrite({ boundaryCoordinates: [at(0, 0), at(100, 100), at(100, 0), at(0, 100)], boundaryMethod: 'drawn' });
        expect(result).toEqual({ ok: false, error: expect.stringMatching(/crosses itself/) });
    });

    it('ignores a typed area while the field keeps its boundary, and accepts it once the boundary is removed', () => {
        const kept = fieldColumnsFromWrite({ name: 'North', areaHectares: 9 }, true);
        expect(kept.ok && kept.data).toEqual({ name: 'North' });
        const cleared = fieldColumnsFromWrite({ areaHectares: 9, boundaryCoordinates: null }, true);
        expect(cleared.ok && cleared.data.areaHectares).toBe(9);
        expect(cleared.ok && cleared.data.boundaryMethod).toBeNull();
    });
});
