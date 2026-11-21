import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SEEDED, apiToken } from '../helpers/auth';
import { JOURNEY } from '../helpers/journey';

const routes = JSON.parse(readFileSync(new URL('./get-routes.json', import.meta.url), 'utf8')) as string[];

/**
 * Every list the API serves is called as people from the Mzuzu region (an officer, a
 * manager, a farmer), and no response may carry a Nakuru farmer's id or phone number.
 * A Nakuru farmer must not see any other farmer either. The route list is generated from
 * the API itself (npm run routes:inventory), so a new route is checked from the day it
 * is added.
 */

/** Routes that act on GET (payment returns, webhooks) or need a query to mean anything. */
const NOT_CALLED = new Set([
  '/api/v1/billing/paypal/subscription-return',
  '/api/v1/billing/paypal/success',
  '/api/v1/billing/paypal/cancel',
  '/api/v1/channels/telegram/webhook',
]);

interface FarmerRow { id: string; phone?: string | null; firstName?: string; lastName?: string }

const digits = (phone?: string | null) => (phone ?? '').replace(/\D/g, '');

async function farmersOf(request: APIRequestContext, token: string): Promise<FarmerRow[]> {
  const res = await request.get('/api/v1/farmers?limit=500', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { data?: FarmerRow[] | { farmers?: FarmerRow[] } };
  return Array.isArray(body.data) ? body.data : (body.data?.farmers ?? []);
}

/**
 * Lines of the form "GET /route → found <marker>" for every leak in the caller's responses.
 * Routes about one farmer are asked about `someoneElse`, whom the caller may not see: any
 * answer other than a refusal or "not found" is a leak.
 */
async function leaksFor(request: APIRequestContext, token: string, markers: Map<string, string>, someoneElse: string): Promise<string[]> {
  const found: string[] = [];
  for (const template of routes) {
    if (NOT_CALLED.has(template)) continue;
    const aboutOneFarmer = template.includes(':');
    const route = template.replace(/:[A-Za-z]+/, someoneElse);
    const res = await request.get(route, { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 }).catch(() => null);
    if (!res) continue;
    if (aboutOneFarmer && res.status() < 300) {
      found.push(`GET ${template} → answered ${res.status()} about a farmer the caller may not see`);
      continue;
    }
    if (res.status() >= 300) continue;
    const text = await res.text().catch(() => '');
    for (const [marker, label] of markers) {
      if (text.includes(marker)) found.push(`GET ${route} → ${label}`);
    }
  }
  return found;
}

test.describe('no list shows another region’s or another farmer’s data', () => {
  test.describe.configure({ timeout: 600_000 });

  let nakuru: FarmerRow[] = [];

  test.beforeAll(async ({ request }) => {
    nakuru = await farmersOf(request, await apiToken(request, SEEDED.officerNakuru));
    expect(nakuru.length, 'the Nakuru officer has farmers to compare against').toBeGreaterThan(0);
  });

  const markersOf = (farmers: FarmerRow[]) => {
    const markers = new Map<string, string>();
    for (const farmer of farmers) {
      const name = `${farmer.firstName ?? ''} ${farmer.lastName ?? ''}`.trim();
      markers.set(farmer.id, `farmer id of ${name}`);
      if (digits(farmer.phone).length >= 9) markers.set(digits(farmer.phone).slice(-9), `phone of ${name}`);
    }
    return markers;
  };

  for (const [role, email] of [
    ['Mzuzu officer', SEEDED.officerMzuzu],
    ['Mzuzu manager', SEEDED.managerMzuzu.email],
    ['Mzuzu farmer', JOURNEY.otherRegionFarmer.email],
  ] as const) {
    test(`${role} sees nothing from Nakuru`, async ({ request }) => {
      const leaks = await leaksFor(request, await apiToken(request, email), markersOf(nakuru), nakuru[0].id);
      expect(leaks, leaks.join('\n')).toEqual([]);
    });
  }

  test('a farmer sees no other farmer', async ({ request }) => {
    const token = await apiToken(request, JOURNEY.farmer.email);
    const others = nakuru.filter(farmer => farmer.id !== JOURNEY.farmer.id);
    const leaks = await leaksFor(request, token, markersOf(others), others[0].id);
    expect(leaks, leaks.join('\n')).toEqual([]);
  });
});
