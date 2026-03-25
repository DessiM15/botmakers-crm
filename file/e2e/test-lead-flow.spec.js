// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Lead Submission → CRM Flow', () => {
  test('leads list page loads with data', async ({ page }) => {
    await page.goto('/leads', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/leads');

    // Should show the leads table with at least one lead
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Leads');
    // Verify at least one of the existing leads appears
    const hasLead = pageContent.includes('Recce Thompson') || pageContent.includes('Test User');
    expect(hasLead).toBe(true);
  });

  test('pipeline page shows leads in stages', async ({ page }) => {
    await page.goto('/pipeline', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/pipeline');

    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Pipeline');
    // Should show pipeline stage columns
    expect(pageContent).toContain('New Lead');
  });

  test('lead detail page loads', async ({ page }) => {
    await page.goto('/leads', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click the first lead row to navigate to detail
    const leadRow = page.locator('tr:has-text("Recce Thompson"), tr:has-text("Test User")').first();
    await leadRow.click();
    await page.waitForTimeout(2000);

    // Should show lead detail with contact info
    const content = await page.textContent('body');
    const hasDetail = content.includes('Recce Thompson') || content.includes('Test User');
    expect(hasDetail).toBe(true);
  });
});
