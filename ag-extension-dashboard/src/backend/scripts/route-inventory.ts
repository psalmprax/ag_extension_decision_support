/**
 * Writes every GET route without path parameters to the access test's route list
 * (src/frontend/tests-e2e/access/get-routes.json), so the cross-region test calls
 * each of them, and every route with its method to all-routes.json for the
 * no-server-errors test. The backend test `routeInventory.test.ts` fails when a route is
 * added or removed without regenerating:  npm run routes:inventory
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
import fs from 'fs';
import { ALL_ROUTES_FILE, currentAllRoutes, currentGetRoutes, ROUTE_LIST_FILE } from '../src/utils/getRouteList';

const routes = currentGetRoutes();
fs.writeFileSync(ROUTE_LIST_FILE, `${JSON.stringify(routes, null, 2)}\n`);
console.log(`Wrote ${routes.length} GET routes to ${ROUTE_LIST_FILE}`);
const all = currentAllRoutes();
fs.writeFileSync(ALL_ROUTES_FILE, `${JSON.stringify(all, null, 2)}\n`);
console.log(`Wrote ${all.length} routes to ${ALL_ROUTES_FILE}`);
setTimeout(() => process.exit(0), 50);
