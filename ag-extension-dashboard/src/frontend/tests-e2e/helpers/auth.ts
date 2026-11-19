import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Shared password for every account written by `npm run seed:realworld`. */
export const SEEDED_PASSWORD = 'Harvest2026!';

/** Seeded fixtures — see `src/backend/src/seed/realWorldSeed.ts`. */
export const SEEDED = {
  managerNakuru: {
    email: 'rm.nakuru@real.agriext.test',
    name: 'Wanjiru Kamau',
    region: 'Rift Valley',
  },
  managerMzuzu: {
    email: 'rm.mzuzu@real.agriext.test',
    name: 'Thokozani Mvula',
    region: 'Northern Region (Mzuzu)',
  },
  officerNakuru: 'officer.nakuru@real.agriext.test',
  officerMzuzu: 'officer.mzuzu@real.agriext.test',
  officerNakuruName: 'Daniel Kiptoo',
  officerMzuzuName: 'Chisomo Banda',
  nakuruFarmers: [
    'Mary Njeri',
    'Samuel Kipchumba',
    'Alice Wambui',
    'Joseph Kimani',
    'Esther Chebet',
    'David Mwangi',
  ],
  mzuzuFarmers: [
    'Loveness Phiri',
    'Yamikani Gondwe',
    'Tawonga Nyirenda',
    'Chimwemwe Mhone',
    'Alinafe Kachale',
    'Blessings Chavula',
  ],
  /** Loveness Phiri — used to prove cross-region reads are refused. */
  mzuzuFarmerId: 'e4000000-0000-4000-8000-000000000011',
} as const;

/** A fresh address per run: `@real.agriext.test` is the reserved seed domain. */
export function uniqueOfficerEmail(): string {
  return `e2e-officer-${Date.now()}-${Math.floor(Math.random() * 10_000)}@real.agriext.test`;
}

/** Signs in through the real login form and waits for the dashboard shell. */
export async function loginThroughUi(
  page: Page,
  email: string,
  password: string = SEEDED_PASSWORD
): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}

/** Bearer token from the real login endpoint, for request-only assertions. */
export async function apiToken(
  request: APIRequestContext,
  email: string,
  password: string = SEEDED_PASSWORD
): Promise<string> {
  const res = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(res.status(), `login for ${email}`).toBe(200);
  const body = (await res.json()) as { data?: { token?: string } };
  const token = body.data?.token;
  expect(token, `token for ${email}`).toBeTruthy();
  return token as string;
}
