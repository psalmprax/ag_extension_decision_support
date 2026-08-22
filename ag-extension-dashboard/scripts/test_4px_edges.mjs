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

  // 1. Capture landing hero badge
  console.log('Capturing Landing Page 4px Hero Badge...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const badgeLocator = page.locator('text=Global Agricultural Decision Support Platform').locator('..');
  const heroShot = path.join(ARTIFACT_DIR, 'hero_4px_badge.png');
  await badgeLocator.screenshot({ path: heroShot });
  console.log(`Saved hero badge screenshot: ${heroShot}`);

  // 2. Capture Collapsed AI Agronomist trigger on Dashboard / Demo
  console.log('Navigating to Demo / Dashboard...');
  await page.goto('http://localhost:4173/demo', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const collapsedBtn = page.locator('button:has-text("AI Agronomist")');
  if (await collapsedBtn.count() > 0) {
    const collapsedShot = path.join(ARTIFACT_DIR, 'ai_agronomist_collapsed_4px.png');
    await collapsedBtn.screenshot({ path: collapsedShot });
    console.log(`Saved collapsed AI Agronomist screenshot: ${collapsedShot}`);

    // 3. Click to expand and capture expanded drawer
    await collapsedBtn.click();
    await page.waitForTimeout(800);

    const drawerShot = path.join(ARTIFACT_DIR, 'ai_agronomist_expanded_4px.png');
    const drawerLocator = page.locator('div:has-text("Multimodal Decision Support")').locator('..').locator('..').locator('..');
    await page.screenshot({ path: drawerShot });
    console.log(`Saved expanded AI Agronomist screenshot: ${drawerShot}`);
  }

  await browser.close();
  preview.kill();
  console.log('4px edge verification complete!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
