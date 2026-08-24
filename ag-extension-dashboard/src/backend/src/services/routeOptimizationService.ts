/**
 * Officer route optimization — pure functions, no I/O.
 * Nearest-neighbor construction weighted by stop priority, then 2-opt improvement.
 * Priority = daysOverdue (follow-up urgency) + vitalScore (farmer need) + outbreak bonus.
 */

export interface RouteStop {
    visitId: string;
    farmerName: string | null;
    lat: number;
    lng: number;
    daysOverdue: number;
    vitalScore: number; // 0-100
    outbreakBonus?: number; // extra weight when district has an active alert
}

export interface PlannedStop extends RouteStop {
    order: number;
    legKm: number;
    priorityWeight: number;
}

const EARTH_R_KM = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}

export function stopPriority(stop: RouteStop): number {
    return Math.min(stop.daysOverdue, 60) * 2 + (stop.vitalScore || 0) / 2 + (stop.outbreakBonus || 0) * 10;
}

/** Greedy nearest-neighbor construction weighted by priority pull. */
function greedyNearest(
    start: { lat: number; lng: number },
    remaining: RouteStop[],
    pull: number
): RouteStop[] {
    const route: RouteStop[] = [];
    let current = start;
    while (remaining.length > 0) {
        let bestIdx = 0;
        let bestCost = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const cost = haversineKm(current, remaining[i]) - (stopPriority(remaining[i]) / 100) * pull;
            if (cost < bestCost) {
                bestCost = cost;
                bestIdx = i;
            }
        }
        current = remaining[bestIdx];
        route.push(remaining.splice(bestIdx, 1)[0]);
    }
    return route;
}

/** Compute the total route distance from start through all stops in order. */
function routeDistance(start: { lat: number; lng: number }, route: RouteStop[]): number {
    let d = haversineKm(start, route[0]);
    for (let i = 0; i < route.length - 1; i++) d += haversineKm(route[i], route[i + 1]);
    return d;
}

/** 2-opt: reverse segments while total distance improves. */
function twoOptImprove(start: { lat: number; lng: number }, route: RouteStop[]): void {
    let improved = true;
    let guard = 0;
    while (improved && guard < 50) {
        improved = false;
        guard += 1;
        for (let i = 0; i < route.length - 1; i++) {
            for (let k = i + 1; k < route.length; k++) {
                const before = routeDistance(start, route);
                const candidate = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
                if (routeDistance(start, candidate) + 0.001 < before) {
                    route.splice(0, route.length, ...candidate);
                    improved = true;
                }
            }
        }
    }
}

/** Build planned stops with leg distances and priority weights. */
function buildPlannedStops(start: { lat: number; lng: number }, route: RouteStop[]): { stops: PlannedStop[]; totalKm: number } {
    let cursor = start;
    let totalKm = 0;
    const stops = route.map((stop, idx) => {
        const leg = haversineKm(cursor, stop);
        totalKm += leg;
        cursor = stop;
        return { ...stop, order: idx + 1, legKm: Math.round(leg * 10) / 10, priorityWeight: Math.round(stopPriority(stop)) };
    });
    return { stops, totalKm: Math.round(totalKm * 10) / 10 };
}

/**
 * Greedy nearest-neighbor from the start point, then 2-opt segment reversal.
 * Priority acts as a virtual proximity bonus: high-priority stops are treated
 * as up to `priorityPullKm` closer than they are, so urgent visits cluster early.
 */
export function optimizeRoute(
    start: { lat: number; lng: number },
    stops: RouteStop[],
    options: { maxStops?: number; priorityPullKm?: number } = {}
): { stops: PlannedStop[]; totalKm: number } {
    const maxStops = options.maxStops ?? 12;
    const pull = options.priorityPullKm ?? 15;

    const remaining = [...stops]
        .sort((a, b) => stopPriority(b) - stopPriority(a))
        .slice(0, maxStops);

    const route = greedyNearest(start, remaining, pull);
    twoOptImprove(start, route);
    return buildPlannedStops(start, route);
}
