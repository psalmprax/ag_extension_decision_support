import path from 'path';
import { routeMounts } from '@/app';
import { listRoutes } from './routeInventory';

/** The access test's copy of the route list (src/frontend/tests-e2e/access/get-routes.json). */
export const ROUTE_LIST_FILE = path.resolve(__dirname, '../../../frontend/tests-e2e/access/get-routes.json');

/** Every route with its method, for the no-server-errors test (tests-e2e/access/all-routes.json). */
export const ALL_ROUTES_FILE = path.resolve(__dirname, '../../../frontend/tests-e2e/access/all-routes.json');

/** "METHOD /api/v1/path" for every route the API serves, sorted. */
export function currentAllRoutes(): string[] {
    return Array.from(new Set(routeMounts.flatMap(mount => listRoutes(mount.router, `/api/v1${mount.path}`)))).sort();
}

/**
 * Every GET route the access test calls, sorted: those without path parameters, and
 * those whose only parameter is a farmer (":farmerId", or ":id" under /farmers), which
 * the test fills with another region's farmer.
 */
export function currentGetRoutes(): string[] {
    const isFarmerParam = (route: string) => {
        const params = route.match(/:[A-Za-z]+/g) ?? [];
        return params.length === 1 && (params[0] === ':farmerId' || /\/farmers\/:id(\/|$)/.test(route));
    };
    return Array.from(new Set(routeMounts
        .flatMap(mount => listRoutes(mount.router, `/api/v1${mount.path}`))
        .filter(route => route.startsWith('GET ') && (!route.includes(':') || isFarmerParam(route)))
        .map(route => route.slice(4))))
        .sort();
}
