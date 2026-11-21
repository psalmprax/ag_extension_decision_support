import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SEEDED, apiToken } from '../helpers/auth';
import { E2E_SYSTEM_ADMIN, JOURNEY } from '../helpers/journey';

const routes = JSON.parse(readFileSync(new URL('./all-routes.json', import.meta.url), 'utf8')) as string[];

/**
 * Every route the API serves, called by each kind of person on the real backend and
 * database, must answer without a server error. Mocked unit tests cannot see a query
 * that names a missing column or a handler that crashes on a bad body; this can. The
 * route list is generated from the API (npm run routes:inventory), so a new route is
 * covered from the day it is added.
 *
 * Reads are called everywhere. Writes are called only against the local stack, with an
 * empty body and ids that match nothing, so they can change nothing on a shared site.
 */

/** Sign-in, account and provider callbacks act on their own terms; streams never end. */
const NOT_CALLED = /^\/api\/v1\/(auth|account)(\/|$)|\/paypal\/|\/webhook|stream|\/sse/;
/** An outside service that is not set up here answers 503 and says so: that is honest, not a crash. */
const HONEST_UNAVAILABLE = /not (available|configured|set up)/i;
const NOBODY = '00000000-0000-4000-8000-000000000000';
const onSharedSite = Boolean(process.env.E2E_BASE_URL);

const people = [
  { label: 'officer', email: SEEDED.officerNakuru },
  { label: 'manager', email: SEEDED.managerNakuru.email },
  { label: 'farmer', email: JOURNEY.farmer.email },
  { label: 'administrator', email: E2E_SYSTEM_ADMIN.email, password: E2E_SYSTEM_ADMIN.password },
];

async function serverErrors(request: APIRequestContext, token: string, writes: boolean): Promise<string[]> {
  const found: string[] = [];
  for (const entry of routes) {
    const [method, template] = entry.split(' ') as [string, string];
    if (NOT_CALLED.test(template) || (method === 'GET') === writes) continue;
    // A read about a farmer asks about one this person may see; everything else matches nobody.
    const path = template
      .replace(':farmerId', writes ? NOBODY : JOURNEY.farmer.id)
      .replace(/:[A-Za-z]+\??/g, NOBODY);
    const res = await request.fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      data: method === 'GET' ? undefined : {},
      timeout: 30_000,
      failOnStatusCode: false,
    }).catch((error: Error) => error);
    if (res instanceof Error) {
      found.push(`${entry} → no answer (${res.message.split('\n')[0]})`);
      continue;
    }
    if (res.status() < 500) continue;
    const body = await res.text().catch(() => '');
    if (res.status() === 503 && HONEST_UNAVAILABLE.test(body)) continue;
    found.push(`${entry} → ${res.status()} ${body.slice(0, 160)}`);
  }
  return found;
}

test.describe('no route answers with a server error', () => {
  test.describe.configure({ timeout: 900_000 });

  for (const person of people) {
    test(`reads, as ${person.label}`, async ({ request }) => {
      const token = await apiToken(request, person.email, person.password?.());
      expect(await serverErrors(request, token, false)).toEqual([]);
    });

    test(`writes with an empty body, as ${person.label}`, async ({ request }) => {
      test.skip(onSharedSite, 'writes run only against the local stack');
      const token = await apiToken(request, person.email, person.password?.());
      expect(await serverErrors(request, token, true)).toEqual([]);
    });
  }
});
