/**
 * In-field agricultural calculators — pure functions, fully offline.
 * Units: hectares, litres, kg, plants. Region-standard assumptions documented
 * per function so officers can verify against their training manuals.
 */

/** Tank volume in litres; typical knapsack = 16L, field sprayers 200–400L. */
export function tankMix(options: {
    productRatePerHa: number; // litres or kg of product per hectare
    areaHa: number;
    tankVolumeL: number;
    waterRateLPerHa: number; // spray volume, e.g. 200 L/ha
}): { productTotal: number; productPerTank: number; tanksNeeded: number; waterTotalL: number } {
    const { productRatePerHa, areaHa, tankVolumeL, waterRateLPerHa } = options;
    if (areaHa <= 0 || tankVolumeL <= 0 || waterRateLPerHa <= 0) {
        throw new Error('Area, tank volume and water rate must be positive');
    }
    const productTotal = productRatePerHa * areaHa;
    const areaPerTank = tankVolumeL / waterRateLPerHa;
    const productPerTank = productRatePerHa * areaPerTank;
    const tanksNeeded = Math.ceil(areaHa / areaPerTank);
    return {
        productTotal: round2(productTotal),
        productPerTank: round2(productPerTank),
        tanksNeeded,
        waterTotalL: Math.ceil(areaHa * waterRateLPerHa),
    };
}

/**
 * Fertilizer blend: grams of nutrient per kg of fertilizer source.
 * Standard sources: Urea 46-0-0, TSP 0-46-0, MOP 0-0-60.
 */
const SOURCES = { urea: { N: 0.46, P: 0, K: 0 }, tsp: { N: 0, P: 0.46, K: 0 }, mop: { N: 0, P: 0, K: 0.6 } };

export function fertilizerBlend(options: {
    targetN: number; // kg N per ha
    targetP: number; // kg P2O5 per ha
    targetK: number; // kg K2O per ha
    areaHa: number;
}): { ureaKg: number; tspKg: number; mopKg: number } {
    const { targetN, targetP, targetK, areaHa } = options;
    if (areaHa <= 0) throw new Error('Area must be positive');

    // Meet P with TSP first, K with MOP, then N with urea (N sources are flexible).
    const tspKg = targetP > 0 ? targetP / SOURCES.tsp.P : 0;
    const mopKg = targetK > 0 ? targetK / SOURCES.mop.K : 0;
    const ureaKg = targetN > 0 ? targetN / SOURCES.urea.N : 0;

    return {
        ureaKg: round1(ureaKg * areaHa),
        tspKg: round1(tspKg * areaHa),
        mopKg: round1(mopKg * areaHa),
    };
}

/** Plant population from spacing (m). Standard: 0.9m rows × 0.25cm in-row maize → ~44,444 plants/ha. */
export function plantingDensity(rowSpacingM: number, inRowSpacingM: number, areaHa: number): { plantsPerHa: number; plantsTotal: number; seedKgApprox: number } {
    if (rowSpacingM <= 0 || inRowSpacingM <= 0 || areaHa <= 0) throw new Error('Spacings and area must be positive');
    const plantsPerHa = 10_000 / (rowSpacingM * inRowSpacingM);
    // Seed rate approx: maize ~4,000 seeds/kg, beans ~3,000 — use 4,000 default with 15% oversow.
    const seedKgApprox = (plantsPerHa * areaHa * 1.15) / 4000;
    return {
        plantsPerHa: Math.round(plantsPerHa),
        plantsTotal: Math.round(plantsPerHa * areaHa),
        seedKgApprox: round1(seedKgApprox),
    };
}

/** Herbicide dose by body weight for knapsack application safety checks (ml per operator-load). */
export function herbicideTankDose(options: {
    productRateLPerHa: number;
    tankVolumeL: number;
    waterRateLPerHa: number;
}): { mlPerTank: number } {
    const { productRateLPerHa, tankVolumeL, waterRateLPerHa } = options;
    if (waterRateLPerHa <= 0) throw new Error('Water rate must be positive');
    return { mlPerTank: Math.round(productRateLPerHa * 1000 * (tankVolumeL / waterRateLPerHa)) };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
function round1(n: number): number {
    return Math.round(n * 10) / 10;
}
