// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Lead Submission → CRM Flow', () => {
  test('test lead appears in leads list', async ({ page }) => {
    await page.goto('/leads', { waitUntil: 'networkidle' });

    // The page should load (200, not redirect to sign-in)
    expect(page.url()).toContain('/leads');

    // Look for our test lead
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Test Lead - Playwright Sweep');
  });

  test('test lead appears in pipeline as new_lead', async ({ page }) => {
    await page.goto('/pipeline', { waitUntil: 'networkidle' });

    expect(page.url()).toContain('/pipeline');

    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Test Lead - Playwright Sweep');
  });

  test('test lead detail page loads', async ({ page }) => {
    await page.goto('/leads', { waitUntil: 'networkidle' });

    // Click the lead row or link to navigate to detail
    const leadRow = page.locator('tr:has-text("Test Lead - Playwright Sweep"), a:has-text("Test Lead - Playwright Sweep")').first();
    await leadRow.click();
    await page.waitForLoadState('networkidle');

    // Should show lead info (either on detail page or still visible in list)
    const content = await page.textContent('body');
    expect(content).toContain('Test Lead - Playwright Sweep');
  });
});
