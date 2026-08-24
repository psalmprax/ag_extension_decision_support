import { describe, it, expect } from 'vitest';
import { tankMix, fertilizerBlend, plantingDensity, herbicideTankDose } from '../lib/agCalculators';

describe('tankMix', () => {
    it('computes product per tank and tank count for a 1ha plot', () => {
        const r = tankMix({ productRatePerHa: 1.5, areaHa: 1, tankVolumeL: 16, waterRateLPerHa: 200 });
        expect(r.productTotal).toBe(1.5);
        expect(r.productPerTank).toBe(0.12); // 16/200 of the per-ha rate
        expect(r.tanksNeeded).toBe(13); // 200/16 = 12.5 → 13
        expect(r.waterTotalL).toBe(200);
    });

    it('scales linearly with area', () => {
        const r = tankMix({ productRatePerHa: 2, areaHa: 3.5, tankVolumeL: 200, waterRateLPerHa: 400 });
        expect(r.productTotal).toBe(7);
        expect(r.tanksNeeded).toBe(7);
    });

    it('rejects non-positive inputs', () => {
        expect(() => tankMix({ productRatePerHa: 1, areaHa: 0, tankVolumeL: 16, waterRateLPerHa: 200 })).toThrow();
    });
});

describe('fertilizerBlend', () => {
    it('converts NPK targets to urea/TSP/MOP quantities', () => {
        const r = fertilizerBlend({ targetN: 92, targetP: 46, targetK: 30, areaHa: 1 });
        expect(r.ureaKg).toBe(200); // 92 / 0.46
        expect(r.tspKg).toBe(100); // 46 / 0.46
        expect(r.mopKg).toBe(50); // 30 / 0.6
    });

    it('scales by area', () => {
        const r = fertilizerBlend({ targetN: 46, targetP: 0, targetK: 0, areaHa: 2 });
        expect(r.ureaKg).toBe(200);
        expect(r.tspKg).toBe(0);
        expect(r.mopKg).toBe(0);
    });
});

describe('plantingDensity', () => {
    it('computes maize population at 0.9m × 0.25m', () => {
        const r = plantingDensity(0.9, 0.25, 1);
        expect(r.plantsPerHa).toBe(44444);
    });

    it('scales total seed with 15% oversow', () => {
        const r = plantingDensity(0.9, 0.25, 1);
        expect(r.seedKgApprox).toBe(Math.round(((44444 * 1.15) / 4000) * 10) / 10);
    });
});

describe('herbicideTankDose', () => {
    it('converts L/ha rate into ml per tank', () => {
        const r = herbicideTankDose({ productRateLPerHa: 2, tankVolumeL: 16, waterRateLPerHa: 200 });
        expect(r.mlPerTank).toBe(160);
    });
});
