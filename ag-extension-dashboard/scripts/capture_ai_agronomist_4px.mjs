import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = '/home/psalmprax/.gemini/antigravity-cli/brain/16db3875-56ef-484d-9150-9d1e5a00cf52';
const FRONTEND_DIR = '/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend';

async function run() {
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: FRONTEND_DIR,
    stdio: 'pipe',
  });

  await new Promise(r => setTimeout(r, 2000));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  // Seed localStorage for zustand persist
  await page.addInitScript(() => {
    localStorage.setItem('token', 'demo-token-xyz');
    localStorage.setItem('isDemo', 'true');
    localStorage.setItem('ag-extension-storage', JSON.stringify({
      state: {
        user: {
          id: 'demo-officer',
          firstName: 'Amina',
          lastName: 'Okafor',
          email: 'amina@gpexts.com',
          role: 'extension_officer',
        },
        isDemo: true,
        darkMode: true,
        liquidEffect: true,
        activeTab: 'dashboard',
      },
      version: 0,
    }));
  });

  console.log('Navigating to http://localhost:4173/dashboard ...');
  await page.goto('http://localhost:4173/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('Finding AI Agronomist collapsed button on dashboard...');
  const aiBtn = page.locator('button:has-text("AI Agronomist")');
  await aiBtn.waitFor({ state: 'visible', timeout: 5000 });

  const collapsedShot = path.join(ARTIFACT_DIR, 'ai_agronomist_collapsed_4px.png');
  await aiBtn.screenshot({ path: collapsedShot });
  console.log(`Saved collapsed screenshot: ${collapsedShot}`);

  const fullDashboardShot = path.join(ARTIFACT_DIR, 'dashboard_with_4px_ai_pill.png');
  await page.screenshot({ path: fullDashboardShot });
  console.log(`Saved full dashboard screenshot: ${fullDashboardShot}`);

  console.log('Clicking AI Agronomist to expand drawer...');
  await aiBtn.click();
  await page.waitForTimeout(800);

  const drawerShot = path.join(ARTIFACT_DIR, 'ai_agronomist_expanded_4px.png');
  await page.screenshot({ path: drawerShot });
  console.log(`Saved expanded drawer screenshot: ${drawerShot}`);

  await browser.close();
  preview.kill();
  console.log('Successfully captured 4px AI Agronomist screenshots!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
