const { chromium } = require('playwright');

(async () => {
  console.log('Testing signup page functionality...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to signup page
    await page.goto('http://149.104.110.122:7503/register');
    console.log('✓ Navigated to register page');
    console.log('Page title:', await page.title());
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    console.log('✓ Page fully loaded');
    
    // Debug: print all inputs on page
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} input elements on page:`);
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      console.log(`  - ${name} (type: ${type})`);
    }
    
    // Try different selector approach
    const firstNameInput = page.locator('input[type="text"]').first();
    await firstNameInput.waitFor({ state: 'visible' });
    await firstNameInput.click();
    await firstNameInput.fill('Test');
    console.log('✓ First name input is clickable and works');

    const lastNameInput = page.locator('input[type="text"]').nth(1);
    await lastNameInput.click();
    await lastNameInput.fill('User');
    console.log('✓ Last name input is clickable and works');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.click();
    const testEmail = `test_${Date.now()}@example.com`;
    await emailInput.fill(testEmail);
    console.log('✓ Email input is clickable and works');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.click();
    await passwordInput.fill('TestPass123!');
    console.log('✓ Password input is clickable and works');

    const confirmPasswordInput = page.locator('input[type="password"]').nth(1);
    await confirmPasswordInput.click();
    await confirmPasswordInput.fill('TestPass123!');
    console.log('✓ Confirm password input is clickable and works');

    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.waitFor({ state: 'visible' });
    console.log('✓ Submit button is visible');
    
    // Test button is clickable
    await submitButton.click();
    console.log('✓ Submit button clicked successfully');
    
    // Check if loading indicator appears
    const loader = page.locator('.animate-spin').first();
    await loader.waitFor({ timeout: 2000 });
    console.log('✓ Loading indicator appears on submission');
    
    console.log('\n✅ ALL TESTS PASSED - Signup page is fully functional and clickable!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-failure.png', fullPage: true });
    console.log('Full page screenshot saved to test-failure.png');
    
    // Print page content for debugging
    console.log('\nPage HTML content:');
    console.log(await page.content());
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
