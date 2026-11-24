/**
 * In-field agricultural calculators — pure functions, fully offline.
 * Units: hectares, litres, kg, plants. They do arithmetic on the numbers the
 * officer enters (label rate, soil-test targets, seed packet); none of them
 * supplies a rate of its own.
 */

/** Product and water per tank, from the label rate and the spray volume the officer enters. */
export function tankMix(options: {
    productRatePerHa: number; // litres or kg of product per hectare
    areaHa: number;
    tankVolumeL: number;
    waterRateLPerHa: number; // spray volume from the label, L/ha
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
 * Fertilizer blend: fraction of nutrient per kg of product, from the grade printed on the bag
 * (urea 46-0-0, TSP 0-46-0, MOP 0-0-60). A bag with another grade needs its own numbers.
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

/**
 * Plant population from spacing (m). Seed weight comes only from the seed packet
 * (seeds per kg), because it differs by crop and variety; without it no seed amount is given.
 */
export function plantingDensity(
    rowSpacingM: number,
    inRowSpacingM: number,
    areaHa: number,
    seedsPerKg?: number,
): { plantsPerHa: number; plantsTotal: number; seedKg: number | null } {
    if (rowSpacingM <= 0 || inRowSpacingM <= 0 || areaHa <= 0) throw new Error('Spacings and area must be positive');
    const plantsPerHa = 10_000 / (rowSpacingM * inRowSpacingM);
    const plantsTotal = plantsPerHa * areaHa;
    return {
        plantsPerHa: Math.round(plantsPerHa),
        plantsTotal: Math.round(plantsTotal),
        seedKg: seedsPerKg && seedsPerKg > 0 ? round1(plantsTotal / seedsPerKg) : null,
    };
}

/** The same per-tank amount in millilitres, for liquid products measured with a cup or syringe. */
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
