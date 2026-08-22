import { chromium, devices } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/psalmprax/.gemini/antigravity-cli/brain/16db3875-56ef-484d-9150-9d1e5a00cf52';

async function run() {
  console.log('Launching browser to test https://www.gpexts.com/ ...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Browser Error]:', err));

  console.log('Navigating to https://www.gpexts.com/ ...');
  const response = await page.goto('https://www.gpexts.com/', {
    waitUntil: 'networkidle',
    timeout: 45000,
  }).catch(async (e) => {
    console.error('Networkidle timeout/error, navigating with domcontentloaded:', e.message);
    return await page.goto('https://www.gpexts.com/', { waitUntil: 'domcontentloaded' });
  });

  console.log('HTTP Status:', response ? response.status() : 'unknown');

  await page.waitForTimeout(3000);

  // Take initial landing page screenshot
  const initialShot = path.join(ARTIFACT_DIR, 'live_landing_liquid_on.png');
  await page.screenshot({ path: initialShot });
  console.log(`Saved screenshot: ${initialShot}`);

  // Check for Liquid toggle switch in the navbar
  const liquidBtn = page.locator('button[aria-label*="liquid"], button[title*="Liquid"], button:has(svg.lucide-droplets)');
  const btnCount = await liquidBtn.count();
  console.log(`Found ${btnCount} liquid toggle buttons on the live page.`);

  // Check for canvas elements in DOM
  const canvas = page.locator('canvas');
  const canvasCount = await canvas.count();
  console.log(`Found ${canvasCount} canvas elements on page.`);

  // Move cursor around to trigger fluid dynamic trails
  console.log('Moving mouse to trigger interactive fluid dynamics...');
  for (let x = 200; x <= 1100; x += 150) {
    await page.mouse.move(x, 350 + Math.sin(x / 60) * 120);
    await page.waitForTimeout(120);
  }

  await page.waitForTimeout(800);
  const motionShot = path.join(ARTIFACT_DIR, 'live_landing_fluid_interaction.png');
  await page.screenshot({ path: motionShot });
  console.log(`Saved screenshot: ${motionShot}`);

  // Click toggle switch to turn OFF if present
  if (btnCount > 0) {
    console.log('Clicking Liquid toggle switch to turn OFF...');
    await liquidBtn.first().click();
    await page.waitForTimeout(1000);

    const offShot = path.join(ARTIFACT_DIR, 'live_landing_liquid_off.png');
    await page.screenshot({ path: offShot });
    console.log(`Saved screenshot (Liquid OFF): ${offShot}`);

    // Click toggle switch to turn back ON
    console.log('Clicking Liquid toggle switch to turn back ON...');
    await liquidBtn.first().click();
    await page.waitForTimeout(1000);

    const onShot = path.join(ARTIFACT_DIR, 'live_landing_liquid_on_again.png');
    await page.screenshot({ path: onShot });
    console.log(`Saved screenshot (Liquid back ON): ${onShot}`);
  }

  // Mobile testing
  console.log('Testing mobile viewport (iPhone 15 Pro)...');
  const mobileContext = await browser.newContext({
    ...devices['iPhone 15 Pro'],
    colorScheme: 'dark',
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('https://www.gpexts.com/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await mobilePage.waitForTimeout(2000);

  const mobileHeroShot = path.join(ARTIFACT_DIR, 'live_mobile_hero.png');
  await mobilePage.screenshot({ path: mobileHeroShot });
  console.log(`Saved mobile hero screenshot: ${mobileHeroShot}`);

  const menuBtn = mobilePage.locator('button[aria-label*="navigation menu"], button:has(svg.lucide-menu)');
  if (await menuBtn.count() > 0) {
    await menuBtn.first().click();
    await mobilePage.waitForTimeout(800);
    const mobileDrawerShot = path.join(ARTIFACT_DIR, 'live_mobile_drawer.png');
    await mobilePage.screenshot({ path: mobileDrawerShot });
    console.log(`Saved mobile drawer screenshot: ${mobileDrawerShot}`);
  }

  await browser.close();
  console.log('Live site testing finished successfully!');
}

run().catch(err => {
  console.error('Fatal live test error:', err);
  process.exit(1);
});
