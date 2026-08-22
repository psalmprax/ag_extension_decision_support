import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';

const ARTIFACT_DIR = '/home/psalmprax/.gemini/antigravity-cli/brain/16db3875-56ef-484d-9150-9d1e5a00cf52';
const FRONTEND_DIR = '/home/psalmprax/ALL_PROJECTS/ag_extension_decision_support/ag-extension-dashboard/src/frontend';

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
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Move mouse around to generate fluid trails when ON
  for (let x = 200; x <= 1000; x += 150) {
    await page.mouse.move(x, 350 + Math.sin(x / 50) * 100);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);

  const canvasCountOn = await page.locator('canvas').count();
  console.log(`Canvas count with Liquid ON: ${canvasCountOn}`);

  const onPath = path.join(ARTIFACT_DIR, 'local_liquid_ON_verified.png');
  await page.screenshot({ path: onPath });
  console.log(`Saved ON screenshot: ${onPath}`);

  // 2. Click toggle button to turn OFF
  const toggleBtn = page.locator('button[aria-label*="liquid"], button[title*="Liquid"], button:has(svg.lucide-droplets)').first();
  await toggleBtn.click();
  await page.waitForTimeout(800);

  // Move mouse around again - NO fluid splats should appear
  for (let x = 200; x <= 1000; x += 150) {
    await page.mouse.move(x, 350 + Math.sin(x / 50) * 100);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);

  const canvasCountOff = await page.locator('canvas').count();
  console.log(`Canvas count with Liquid OFF: ${canvasCountOff}`);

  const offPath = path.join(ARTIFACT_DIR, 'local_liquid_OFF_verified.png');
  await page.screenshot({ path: offPath });
  console.log(`Saved OFF screenshot: ${offPath}`);

  await browser.close();
  preview.kill();
  console.log('Verification test completed!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
