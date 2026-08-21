import { chromium, devices } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = '/home/psalmprax/.gemini/antigravity-cli/brain/16db3875-56ef-484d-9150-9d1e5a00cf52';
const FRONTEND_DIR = '/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend';

async function run() {
  console.log('Starting Vite preview server on port 4173...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: FRONTEND_DIR,
    stdio: 'pipe',
  });

  preview.stdout.on('data', d => console.log(`[Vite] ${d}`));
  preview.stderr.on('data', d => console.error(`[Vite ERR] ${d}`));

  await new Promise(r => setTimeout(r, 3000));

  console.log('Launching Playwright Chromium mobile emulation...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    ...devices['iPhone 15 Pro'],
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  console.log('1. Capturing Mobile Landing Page...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const landingPath = path.join(ARTIFACT_DIR, 'mobile_landing_hero.png');
  await page.screenshot({ path: landingPath, fullPage: false });
  console.log(`Saved: ${landingPath}`);

  console.log('2. Capturing Mobile Landing Page (Full Page)...');
  const landingFullPath = path.join(ARTIFACT_DIR, 'mobile_landing_full.png');
  await page.screenshot({ path: landingFullPath, fullPage: true });
  console.log(`Saved: ${landingFullPath}`);

  console.log('3. Capturing Mobile Menu Drawer...');
  const menuButton = page.locator('button[aria-label="Toggle Menu"], button:has(svg.lucide-menu), header button');
  if (await menuButton.count() > 0) {
    await menuButton.first().click();
    await page.waitForTimeout(600);
    const drawerPath = path.join(ARTIFACT_DIR, 'mobile_menu_drawer.png');
    await page.screenshot({ path: drawerPath });
    console.log(`Saved: ${drawerPath}`);
  }

  console.log('4. Capturing Demo on Mobile...');
  await page.goto('http://localhost:4173/demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const demoPath = path.join(ARTIFACT_DIR, 'mobile_demo_view.png');
  await page.screenshot({ path: demoPath });
  console.log(`Saved: ${demoPath}`);

  await browser.close();
  preview.kill();
  console.log('Done capturing mobile screenshots!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
