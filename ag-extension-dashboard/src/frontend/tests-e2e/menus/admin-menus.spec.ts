import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { E2E_SYSTEM_ADMIN, openMenu, signedIn } from '../helpers/journey';
import { apiData } from './menuStories';

/**
 * What the system administrator expects from the administration pages. Runs with the
 * run's temporary administrator (E2E_SYSTEM_ADMIN_PASSWORD), or E2E_ADMIN_EMAIL and
 * E2E_ADMIN_PASSWORD locally.
 */
const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_SYSTEM_ADMIN_PASSWORD;
const email = process.env.E2E_ADMIN_EMAIL ?? E2E_SYSTEM_ADMIN.email;

test.describe('the system administrator works through the administration pages', () => {
  test.skip(!password, 'needs an administrator password');
  test.setTimeout(180_000);
  let context: BrowserContext;
  let page: Page;
  let adminRequest: Parameters<typeof apiData>[0];

  test.beforeAll(async ({ browser, playwright }) => {
    ({ context, page } = await signedIn(browser, email, password));
    adminRequest = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  });
  test.afterAll(async () => context?.close());

  async function adminData<T>(path: string): Promise<T> {
    const login = await adminRequest.post('/api/auth/login', { data: { email, password } });
    const token = (await login.json()).data.token as string;
    const response = await adminRequest.get(path, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.ok(), `${path} → ${response.status()}`).toBeTruthy();
    return (await response.json()).data as T;
  }

  test('Staff & officers: lists every account on record', async () => {
    const users = await adminData<Array<{ email: string }>>('/api/users?limit=500');
    await openMenu(page, 'Staff & officers');
    await expect(page.getByText(new RegExp(`${users.length} (people|accounts|users)`))).toBeVisible();
    await expect(page.getByText(users[0].email).first()).toBeVisible();
  });

  test('System: every service on record is shown with its real state', async () => {
    const components = await adminData<Array<{ component: string; status: string }>>('/api/system/health/components');
    await openMenu(page, 'System');
    for (const component of components) {
      await expect(page.getByText(component.component).first()).toBeVisible();
    }
    const offline = components.filter(c => c.status === 'offline').length;
    await expect(page.getByRole('group', { name: 'Offline' })).toContainText(String(offline));
  });
});
