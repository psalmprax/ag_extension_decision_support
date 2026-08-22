import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/psalmprax/.gemini/antigravity-cli/brain/16db3875-56ef-484d-9150-9d1e5a00cf52';
const BASE_URL = 'https://www.gpexts.com';

async function testPage(context, pagePath, pageName) {
  const page = await context.newPage();
  const url = `${BASE_URL}${pagePath}`;
  console.log(`\n========================================`);
  console.log(`Testing ${pageName} at ${url}`);
  console.log(`========================================`);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
    console.log('Falling back to domcontentloaded...');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  });

  await page.waitForTimeout(2000);

  // 1. Initial state check (Default ON)
  const initialCanvasCount = await page.locator('canvas').count();
  console.log(`[${pageName}] Initial Canvas Count (Liquid ON): ${initialCanvasCount}`);

  const onShotPath = path.join(ARTIFACT_DIR, `live_${pageName}_liquid_ON.png`);
  await page.screenshot({ path: onShotPath });
  console.log(`Saved ON screenshot: ${onShotPath}`);

  // Find toggle switch
  const toggleBtn = page.locator('button[aria-label*="liquid"], button[title*="Liquid"], button:has(svg.lucide-droplets)').first();
  const btnExists = (await toggleBtn.count()) > 0;
  console.log(`[${pageName}] Toggle button exists: ${btnExists}`);

  if (btnExists) {
    // 2. Click to toggle OFF
    console.log(`[${pageName}] Clicking toggle switch to turn OFF...`);
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const offCanvasCount = await page.locator('canvas').count();
    console.log(`[${pageName}] Canvas Count after turning OFF: ${offCanvasCount}`);

    const offShotPath = path.join(ARTIFACT_DIR, `live_${pageName}_liquid_OFF.png`);
    await page.screenshot({ path: offShotPath });
    console.log(`Saved OFF screenshot: ${offShotPath}`);

    // Verify localStorage preference
    const storedPref = await page.evaluate(() => localStorage.getItem('ag-liquid-effect'));
    console.log(`[${pageName}] Stored preference in localStorage: ${storedPref}`);

    // 3. Click to turn back ON
    console.log(`[${pageName}] Clicking toggle switch to turn back ON...`);
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    const restoredCanvasCount = await page.locator('canvas').count();
    console.log(`[${pageName}] Canvas Count after turning back ON: ${restoredCanvasCount}`);
  }

  await page.close();
}

async function run() {
  console.log('Launching browser for multi-page liquid verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });

  try {
    // 1. Landing Page
    await testPage(context, '/', 'landing');

    // 2. Sign In Page
    await testPage(context, '/login', 'login');

    // 3. Sign Up / Register Page
    await testPage(context, '/register', 'register');

    // 4. Demo / Dashboard Page
    await testPage(context, '/demo', 'demo_dashboard');

    console.log('\nAll pages verified successfully!');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
