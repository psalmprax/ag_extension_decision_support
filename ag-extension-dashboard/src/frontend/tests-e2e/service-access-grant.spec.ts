import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { SEEDED } from './helpers/auth';
import {
  E2E_SYSTEM_ADMIN,
  FARMER_CHAT_MENU,
  JOURNEY,
  MY_OFFICER_LOCKED_MENU,
  MY_OFFICER_MENU,
  apiAs,
  daysFromNow,
  openMenu,
  signedIn,
} from './helpers/journey';

/**
 * The system administrator opens the officer chat to a farmer on the Free plan
 * without changing their plan, then takes it back — each person in their own
 * browser, against the real backend and database:
 *
 *  1. Joseph (Free) sees "My officer" locked; the server refuses the chat.
 *  2. The system administrator grants him "Farmer chat" until a set date.
 *  3. Joseph writes to his officer; Daniel (the Nakuru officer) reads and replies.
 *  4. The administrator revokes it: Joseph's menu locks again and the server refuses.
 *
 * Officers and managers cannot grant access themselves.
 */
const farmer = JOURNEY.freeFarmer;
const question = 'Hello Daniel, my bean leaves have rust-coloured spots after the rains. What should I do?';
const reply = 'Thanks Joseph — pick off the worst leaves today; I will come on Thursday to check the whole plot.';

test.describe.serial('service access granted by the system administrator', () => {
  let admin: { context: BrowserContext; page: Page };
  let farmerSession: { context: BrowserContext; page: Page };
  let officer: { context: BrowserContext; page: Page };
  let threadId = '';

  test.beforeAll(async ({ browser }) => {
    admin = await signedIn(browser, E2E_SYSTEM_ADMIN.email, E2E_SYSTEM_ADMIN.password());
    farmerSession = await signedIn(browser, farmer.email);
    officer = await signedIn(browser, SEEDED.officerNakuru);
  });

  test.afterAll(async () => {
    await Promise.all([admin?.context.close(), farmerSession?.context.close(), officer?.context.close()]);
  });

  async function openServiceAccess(): Promise<ReturnType<Page['getByRole']>> {
    const page = admin.page;
    await openMenu(page, 'Staff & Officers');
    await page.getByPlaceholder(/Search by name, email/).fill(farmer.email);
    await page.getByRole('button', { name: `Edit access for ${farmer.name}` }).click();
    const section = page.getByRole('dialog').getByRole('group', { name: 'Service access' });
    await expect(section).toBeVisible();
    return section;
  }

  test('a Free farmer has the officer chat locked, and the server refuses it', async ({ request }) => {
    const nav = farmerSession.page.getByRole('navigation').first();
    await expect(nav.getByRole('button', { name: MY_OFFICER_LOCKED_MENU })).toBeVisible();
    const api = await apiAs(request, farmer.email);
    const res = await api.post('/api/v1/chatbot/conversations', { kind: 'farmer_thread', language: 'en' });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ upgradeRequired: true });
  });

  test('officers and managers cannot grant access', async ({ request }) => {
    const farmerId = (await myProfile(request, farmer.email)).id;
    for (const email of [SEEDED.officerNakuru, SEEDED.managerNakuru.email]) {
      const staff = await apiAs(request, email);
      expect((await staff.put(`/api/v1/users/${farmerId}/service-access/chat`, {})).status(), email).toBe(403);
      expect((await staff.get(`/api/v1/users/${farmerId}/service-access`)).status(), email).toBe(403);
    }
  });

  test('the system administrator grants him the farmer chat until a set date', async () => {
    const section = await openServiceAccess();
    const until = daysFromNow(30).date;
    await section.getByLabel('New grants end on (optional)').fill(until);
    await section.getByRole('button', { name: 'Grant: Farmer chat & AI assistant' }).click();
    await expect(section.getByRole('button', { name: 'Revoke: Farmer chat & AI assistant' })).toBeVisible();
    await expect(section.getByText(/Granted until/)).toBeVisible();
    // Only the services that suit a farmer are offered.
    await expect(section.getByRole('button', { name: /Operational analytics/ })).toHaveCount(0);
    await admin.page.keyboard.press('Escape');
  });

  test('the farmer writes to his officer, still on the Free plan', async ({ request }) => {
    const page = farmerSession.page;
    await page.reload();
    await openMenu(page, MY_OFFICER_MENU);
    await expect(page.getByRole('heading', { name: 'My extension officer' })).toBeVisible();
    await page.getByLabel('Message to your officer').fill(question);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('group', { name: 'You message' }).filter({ hasText: 'rust-coloured spots' })).toBeVisible();

    const me = await myProfile(request, farmer.email);
    expect(me.planName).toBe('Free');
    expect(me.serviceAccess).toEqual(['chat']);
    // The same thread (create-or-get), kept to check the refusal after the grant is revoked.
    const api = await apiAs(request, farmer.email);
    threadId = ((await (await api.post('/api/v1/chatbot/conversations', { kind: 'farmer_thread', language: 'en' })).json()) as { data: { id: string } }).data.id;
  });

  test('the officer reads the message and replies', async () => {
    const page = officer.page;
    await page.reload();
    await openMenu(page, FARMER_CHAT_MENU);
    await page.getByRole('button', { name: new RegExp(farmer.name) }).first().click();
    await expect(page.getByRole('group', { name: 'Farmer message' }).filter({ hasText: 'rust-coloured spots' })).toBeVisible();
    await page.getByLabel('Message to the farmer').fill(reply);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'come on Thursday' })).toBeVisible();

    await farmerSession.page.reload();
    await openMenu(farmerSession.page, MY_OFFICER_MENU);
    await expect(farmerSession.page.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'come on Thursday' })).toBeVisible();
  });

  test('the system administrator revokes it, and the chat locks again', async ({ request }) => {
    const section = await openServiceAccess();
    await section.getByRole('button', { name: 'Revoke: Farmer chat & AI assistant' }).click();
    await expect(section.getByRole('button', { name: 'Grant: Farmer chat & AI assistant' })).toBeVisible();
    await expect(section.getByText('Not granted').first()).toBeVisible();

    const api = await apiAs(request, farmer.email);
    const res = await api.post('/api/v1/chatbot/messages', { conversationId: threadId, content: 'One more question' });
    expect(res.status()).toBe(403);
    await farmerSession.page.reload();
    await expect(farmerSession.page.getByRole('navigation').first().getByRole('button', { name: MY_OFFICER_LOCKED_MENU })).toBeVisible();
  });

  // API calls use the separate `request` context: a page's request context shares its
  // browser's cookies, so logging in through it would switch that browser's account.
  async function myProfile(request: APIRequestContext, email: string): Promise<{ id: string; planName: string; serviceAccess: string[] }> {
    const api = await apiAs(request, email);
    return ((await (await api.get('/api/v1/auth/me')).json()) as { data: { id: string; planName: string; serviceAccess: string[] } }).data;
  }
});
