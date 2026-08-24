import { describe, it, expect } from 'vitest';
import { tilesForBbox, estimateDownload } from '../lib/offlineTiles';

// Lilongwe district-ish bbox
const BBOX = { minLat: -14.2, minLng: 33.5, maxLat: -13.8, maxLng: 34.0 };

describe('tilesForBbox', () => {
    it('produces deterministic tile lists', () => {
        const a = tilesForBbox(BBOX, 8, 10);
        const b = tilesForBbox(BBOX, 8, 10);
        expect(a).toEqual(b);
    });

    it('tile count grows ~4x per zoom level', () => {
        const z10 = tilesForBbox(BBOX, 10, 10).length;
        const z11 = tilesForBbox(BBOX, 11, 11).length;
        expect(z11).toBeGreaterThan(z10);
        expect(z11).toBeGreaterThanOrEqual(z10 * 2);
    });

    it('never produces negative or out-of-range tile coords', () => {
        const tiles = tilesForBbox(BBOX, 8, 12);
        for (const t of tiles) {
            expect(t.x).toBeGreaterThanOrEqual(0);
            expect(t.y).toBeGreaterThanOrEqual(0);
            expect(t.x).toBeLessThan(2 ** t.z);
            expect(t.y).toBeLessThan(2 ** t.z);
            expect(t.url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
        }
    });

    it('handles inverted bbox input without throwing', () => {
        const tiles = tilesForBbox({ minLat: -13.8, minLng: 34.0, maxLat: -14.2, maxLng: 33.5 }, 8, 9);
        expect(tiles.length).toBeGreaterThan(0);
    });

    it('estimateDownload scales with tile count', () => {
        const est = estimateDownload(BBOX, 8, 14);
        expect(est.approxKb).toBe(Math.round(est.tiles * 18));
    });
});
