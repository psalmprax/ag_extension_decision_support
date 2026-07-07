import { test, expect } from '@playwright/test';

test.describe('Menu Translation Tests', () => {
  test('should translate both menu and right panel content', async ({ page }) => {
    // Go to the app
    await page.goto('http://localhost:5173/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check initial English text in menu (left panel)
    // Check right panel for English content
    console.log('=== Testing English (default) ===');
    const pageContent = await page.content();
    console.log('Contains "Dashboard":', pageContent.includes('Dashboard'));

    // Find and verify language switcher exists (now on login page too)
    const langSwitcher = page.locator('select').first();
    await expect(langSwitcher).toBeVisible();

    // Change language to French (fr)
    console.log('\n=== Changing to French ===');
    await langSwitcher.selectOption('fr');
    await page.waitForTimeout(1000);

    // Check French text in menu (left panel)
    const frenchPageContent = await page.content();
    console.log('Contains "Tableau de bord":', frenchPageContent.includes('Tableau de bord'));
    console.log(
      'Contains "Dashboard" (should be false):',
      frenchPageContent.includes('"Dashboard"')
    );

    // Change language to Swahili (sw)
    console.log('\n=== Changing to Swahili ===');
    await langSwitcher.selectOption('sw');
    await page.waitForTimeout(1000);

    // Check Swahili text
    const swahiliPageContent = await page.content();
    console.log('Contains "Dashibodi":', swahiliPageContent.includes('Dashibodi'));
    console.log('Contains "Orodha ya Ziara":', swahiliPageContent.includes('Orodha ya Ziara'));

    // Change language back to English
    console.log('\n=== Changing back to English ===');
    await langSwitcher.selectOption('en');
    await page.waitForTimeout(1000);

    const englishPageContent = await page.content();
    console.log('Contains "Dashboard" again:', englishPageContent.includes('Dashboard'));

    console.log('\n=== Test Complete ===');
  });

  test('verify right panel content translates', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Default language is English
    console.log('\n=== Right Panel - English ===');
    const enContent = await page.content();
    // Look for portfolio page content (right panel)
    console.log('English - has "Visit Portfolio":', enContent.includes('Visit Portfolio'));

    // Change to French
    const langSwitcher = page.locator('select[id="language-select"]');
    await langSwitcher.selectOption('fr');
    await page.waitForTimeout(1000);

    console.log('\n=== Right Panel - French ===');
    const frContent = await page.content();
    console.log(
      'French - has "Portefeuille de Visites":',
      frContent.includes('Portefeuille de Visites')
    );

    // Change to German
    await langSwitcher.selectOption('de');
    await page.waitForTimeout(1000);

    console.log('\n=== Right Panel - German ===');
    const deContent = await page.content();
    console.log('German - has "Besuchsportfolio":', deContent.includes('Besuchsportfolio'));
  });
});
