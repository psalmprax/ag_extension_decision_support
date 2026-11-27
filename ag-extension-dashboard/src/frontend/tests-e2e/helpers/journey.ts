import { deflateSync } from 'node:zlib';
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { apiToken, loginThroughUi } from './auth';

/**
 * The officer–farmer journey fixtures. The first three farmers of each region
 * are on Pro (chat, visits and progress are paid features); the rest are on
 * Free. Ids are the seed's (src/backend/src/seed/realWorldSeed.ts).
 */
export const JOURNEY = {
  /** Mary Njeri, Rift Valley, Pro: the farmer the Nakuru officer works with. */
  farmer: {
    email: 'farmer.nakuru.01@real.agriext.test',
    name: 'Mary Njeri',
    id: 'e4000000-0000-4000-8000-000000000001',
  },
  /** Joseph Kimani, Rift Valley, Free plan. */
  freeFarmer: {
    email: 'farmer.nakuru.04@real.agriext.test',
    name: 'Joseph Kimani',
  },
  /** Loveness Phiri, Northern Region (Mzuzu): outside the Nakuru officer's region. */
  otherRegionFarmer: {
    email: 'farmer.mzuzu.01@real.agriext.test',
    name: 'Loveness Phiri',
    id: 'e4000000-0000-4000-8000-000000000011',
  },
  officerNakuruId: 'e2000000-0000-4000-8000-000000000001',
  officerMzuzuId: 'e2000000-0000-4000-8000-000000000002',
} as const;

/** A real PNG (solid colour), so the upload route's file-signature check passes. */
export function pngPhoto(
  name: string,
  rgb: [number, number, number] = [72, 140, 48],
  size: { width: number; height: number } = { width: 24, height: 24 },
): { name: string; mimeType: string; buffer: Buffer } {
  const { width, height } = size;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from(rgb))]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (data: Buffer) => {
    let c = 0xffffffff;
    for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { name, mimeType: 'image/png', buffer };
}

/** A signed-in browser for one person, separate from everyone else's cookies. */
export async function signedIn(browser: Browser, email: string, password?: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginThroughUi(page, email, password);
  return { context, page };
}

/** Opens a page from the side menu by its visible label. */
export async function openMenu(page: Page, label: string | RegExp): Promise<void> {
  const nav = page.getByRole('navigation').first();
  const item = nav.getByRole('button', typeof label === 'string' ? { name: label, exact: true } : { name: label }).first();
  await nav.getByRole('button').first().waitFor({ timeout: 30_000 });
  // Menu sections other than the current one start collapsed: open them until the item shows.
  const collapsed = nav.locator('button[aria-expanded="false"]');
  while (!(await item.isVisible()) && (await collapsed.count()) > 0) {
    await collapsed.first().click();
  }
  await item.click({ timeout: 30_000 });
}

/** The officer's chat with farmers ("Farmer chat" in the side menu), with or without its unread badge. */
export const FARMER_CHAT_MENU = /^Farmer (direct )?chat( \d+ unread messages?)?$/i;

/** The farmer's chat with their officer ("My officer"), with or without its unread badge. */
export const MY_OFFICER_MENU = /^My officer( \d+ unread messages?)?$/;

/** The same item when it is locked for the Free plan (its lock reads "Pro plan required"). */
export const MY_OFFICER_LOCKED_MENU = /^My officer.*Pro plan required$/;

/**
 * The test system administrator that global-setup creates with a password
 * generated for this run (prisma/seed-e2e-system-admin.ts).
 */
export const E2E_SYSTEM_ADMIN = {
  email: 'e2e.system.admin@real.agriext.test',
  password: (): string => {
    const password = process.env.E2E_SYSTEM_ADMIN_PASSWORD;
    if (!password) throw new Error('E2E_SYSTEM_ADMIN_PASSWORD is set by global-setup');
    return password;
  },
};

/**
 * The administrator for this run: the one global-setup creates locally, or the one a shared
 * site's workflow passes in. Undefined when neither is set (admin-only steps are skipped).
 */
export function e2eAdmin(): { email: string; password: string } | undefined {
  const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_SYSTEM_ADMIN_PASSWORD;
  return password ? { email: process.env.E2E_ADMIN_EMAIL ?? E2E_SYSTEM_ADMIN.email, password } : undefined;
}

/** Bearer-token API access as one seeded account (or another, with its password). */
export async function apiAs(request: APIRequestContext, email: string, password?: string) {
  const headers = { Authorization: `Bearer ${await apiToken(request, email, password)}` };
  return {
    get: (url: string) => request.get(url, { headers }),
    post: (url: string, data: unknown) => request.post(url, { headers, data }),
    patch: (url: string, data: unknown) => request.patch(url, { headers, data }),
    put: (url: string, data: unknown) => request.put(url, { headers, data }),
    delete: (url: string, data?: unknown) => request.delete(url, { headers, ...(data === undefined ? {} : { data }) }),
    upload: (farmerId: string, photo: ReturnType<typeof pngPhoto>) =>
      request.post('/api/v1/upload/upload', { headers, multipart: { file: photo, farmerId } }),
  };
}

/** True once every image in the locator has actually loaded (not a broken image). */
export async function expectImagesLoaded(images: Locator): Promise<void> {
  await expect(images.first()).toBeVisible();
  await expect
    .poll(async () => images.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)))
    .toBe(true);
}

/** YYYY-MM-DD `days` from today, and a datetime-local value at 09:00 on that day. */
export function daysFromNow(days: number): { date: string; dateTimeLocal: string } {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { date, dateTimeLocal: `${date}T09:00` };
}

/** A phone number no other farmer has. */
export function uniquePhone(countryCode = '+254'): string {
  return `${countryCode}7${String(Date.now()).slice(-8)}`;
}

/** Width and height of a PNG or JPEG, given as bytes, base64 or a data URL. */
export function imageSizeOf(image: Buffer | string): { width: number; height: number } {
  const bytes = typeof image === 'string' ? Buffer.from(image.replace(/^data:[^,]*,/, ''), 'base64') : image;
  if (bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: walk the segments to the start-of-frame marker, which holds the size.
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xff) throw new Error(`not a JPEG segment at byte ${at}`);
    const marker = bytes[at + 1];
    const length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  throw new Error('image size not found');
}

/**
 * While billing is switched off (ag-extension-shared/src/api/billingSwitch.ts): the menu has
 * no Billing item for this account, the billing address does not show Billing, and the
 * server refuses to start a subscription. Every menu section is opened first, so a hidden
 * item is truly absent.
 */
export async function expectBillingSwitchedOff(page: Page, request: APIRequestContext, email: string): Promise<void> {
  const nav = page.getByRole('navigation').first();
  await nav.getByRole('button').first().waitFor({ timeout: 30_000 });
  const collapsed = nav.locator('button[aria-expanded="false"]');
  while ((await collapsed.count()) > 0) await collapsed.first().click();
  await expect(nav.getByRole('button', { name: /^Billing/ })).toHaveCount(0);

  // The billing address opens the account's own first page instead (a farmer's dashboard has
  // no address of its own, so the address bar may still read /billing).
  await page.goto('/billing');
  const title = page.getByRole('heading', { level: 1 }).first();
  await expect(title).toBeVisible();
  await expect(title).not.toHaveText(/^Billing/);

  const api = await apiAs(request, email);
  const refused = await api.post('/api/v1/billing/subscribe', { planId: 'pro' });
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toMatchObject({ code: 'BILLING_DISABLED' });
}
