/**
 * Writes every GET route without path parameters to the access test's route list
 * (src/frontend/tests-e2e/access/get-routes.json), so the cross-region test calls
 * each of them. The backend test `routeInventory.test.ts` fails when a route is
 * added or removed without regenerating:  npm run routes:inventory
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
import fs from 'fs';
import { currentGetRoutes, ROUTE_LIST_FILE } from '../src/utils/getRouteList';

const routes = currentGetRoutes();
fs.writeFileSync(ROUTE_LIST_FILE, `${JSON.stringify(routes, null, 2)}\n`);
console.log(`Wrote ${routes.length} GET routes to ${ROUTE_LIST_FILE}`);
setTimeout(() => process.exit(0), 50);
