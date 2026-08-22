import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = '/home/psalmprax/.gemini/antigravity-cli/brain/16db3875-56ef-484d-9150-9d1e5a00cf52';
const FRONTEND_DIR = '/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend';
const BASE_URL = 'http://localhost:4173';

async function testPage(page, pathUrl, name) {
  console.log(`\nTesting ${name} (${pathUrl})...`);
  await page.goto(`${BASE_URL}${pathUrl}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const initialCanvasCount = await page.locator('canvas').count();
  console.log(`[${name}] Initial Canvas Count (ON): ${initialCanvasCount}`);

  const toggleBtn = page.locator('button[aria-label*="liquid"], button[title*="Liquid"], button:has(svg.lucide-droplets)').first();
  const btnExists = (await toggleBtn.count()) > 0;
  console.log(`[${name}] Toggle Button Found: ${btnExists}`);

  if (btnExists) {
    // Click toggle to turn OFF
    await toggleBtn.click();
    await page.waitForTimeout(600);

    const offCanvasCount = await page.locator('canvas').count();
    console.log(`[${name}] Canvas Count when OFF: ${offCanvasCount}`);

    const offShot = path.join(ARTIFACT_DIR, `local_${name}_OFF.png`);
    await page.screenshot({ path: offShot });
    console.log(`Saved OFF screenshot: ${offShot}`);

    // Click toggle to turn back ON
    await toggleBtn.click();
    await page.waitForTimeout(600);

    const onCanvasCount = await page.locator('canvas').count();
    console.log(`[${name}] Canvas Count when back ON: ${onCanvasCount}`);

    const onShot = path.join(ARTIFACT_DIR, `local_${name}_ON.png`);
    await page.screenshot({ path: onShot });
    console.log(`Saved ON screenshot: ${onShot}`);
  }
}

async function run() {
  console.log('Starting preview server...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: FRONTEND_DIR,
    stdio: 'pipe',
  });

  await new Promise(r => setTimeout(r, 2500));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await testPage(page, '/', 'landing');
  await testPage(page, '/login', 'login');
  await testPage(page, '/register', 'register');

  await browser.close();
  preview.kill();
  console.log('\nAll local checks completed!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
