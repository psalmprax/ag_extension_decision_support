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

    const route: RouteStop[] = [];
    let current = start;
    while (remaining.length > 0) {
        let bestIdx = 0;
        let bestCost = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i];
            const cost = haversineKm(current, candidate) - (stopPriority(candidate) / 100) * pull;
            if (cost < bestCost) {
                bestCost = cost;
                bestIdx = i;
            }
        }
        current = remaining[bestIdx];
        route.push(remaining.splice(bestIdx, 1)[0]);
    }

    // 2-opt: reverse segments while total distance improves.
    const legKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => haversineKm(a, b);
    const routeDistance = (r: RouteStop[]): number => {
        let d = legKm(start, r[0]);
        for (let i = 0; i < r.length - 1; i++) d += legKm(r[i], r[i + 1]);
        return d;
    };

    let improved = true;
    let guard = 0;
    while (improved && guard < 50) {
        improved = false;
        guard += 1;
        for (let i = 0; i < route.length - 1; i++) {
            for (let k = i + 1; k < route.length; k++) {
                const before = routeDistance(route);
                const candidate = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
                if (routeDistance(candidate) + 0.001 < before) {
                    route.splice(0, route.length, ...candidate);
                    improved = true;
                }
            }
        }
    }

    let cursor = start;
    let totalKm = 0;
    const planned = route.map((stop, idx) => {
        const leg = legKm(cursor, stop);
        totalKm += leg;
        cursor = stop;
        return { ...stop, order: idx + 1, legKm: Math.round(leg * 10) / 10, priorityWeight: Math.round(stopPriority(stop)) };
    });

    return { stops: planned, totalKm: Math.round(totalKm * 10) / 10 };
}
