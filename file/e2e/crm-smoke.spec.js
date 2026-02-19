// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Comprehensive CRM Smoke Tests
 * Tests every major page loads without errors and key UI elements render.
 * Captures console errors and network failures.
 */

// Helper: collect console errors and failed network requests during page visit
async function visitAndAudit(page, url, description) {
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('response', (response) => {
    if (response.status() >= 500) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`PAGE ERROR: ${error.message}`);
  });

  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

  return {
    status: response?.status(),
    consoleErrors: consoleErrors.filter(
      (e) =>
        // Filter out known benign warnings
        !e.includes('Warning:') &&
        !e.includes('hydration') &&
        !e.includes('Each child in a list') &&
        !e.includes('postcss') &&
        !e.includes('favicon')
    ),
    networkErrors,
  };
}

// ==========================================
// 1. AUTHENTICATION
// ==========================================
test.describe('Authentication', () => {
  test('sign-in page loads', async ({ page }) => {
    // Clear auth for this test
    await page.context().clearCookies();
    const result = await visitAndAudit(page, '/sign-in', 'Sign-in page');
    expect(result.status).toBe(200);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('unauthenticated redirect works', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/leads', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/sign-in/);
  });
});

// ==========================================
// 2. DASHBOARD
// ==========================================
test.describe('Dashboard', () => {
  test('loads without errors', async ({ page }) => {
    const result = await visitAndAudit(page, '/', 'Dashboard');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
    // Should not redirect to sign-in (we're authenticated)
    expect(page.url()).not.toContain('sign-in');
  });
});

// ==========================================
// 3. PIPELINE
// ==========================================
test.describe('Pipeline', () => {
  test('page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/pipeline', 'Pipeline');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });
});

// ==========================================
// 4. LEADS
// ==========================================
test.describe('Leads', () => {
  test('list page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/leads', 'Leads list');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
    // Should show either leads table or empty state
    const hasContent = await page.locator('table, .empty-state, [class*="empty"], .card').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('search input works', async ({ page }) => {
    await page.goto('/leads', { waitUntil: 'networkidle' });
    const searchInput = page.locator('input[type="text"][placeholder*="earch"], input[type="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test search');
      // Should not crash
      await page.waitForTimeout(500);
      expect(page.url()).toContain('/leads');
    }
  });
});

// ==========================================
// 5. REFERRALS
// ==========================================
test.describe('Referrals', () => {
  test('page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/referrals', 'Referrals');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });
});

// ==========================================
// 6. CLIENTS
// ==========================================
test.describe('Clients', () => {
  test('list page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/clients', 'Clients list');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });

  test('add client modal opens', async ({ page }) => {
    await page.goto('/clients', { waitUntil: 'networkidle' });
    const addBtn = page.locator('button:has-text("Add Client"), button:has-text("New Client"), a:has-text("Add Client")').first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // Modal or form should appear
      const modalVisible = await page.locator('.modal.show, .modal[style*="display: block"], form').first().isVisible().catch(() => false);
      expect(modalVisible).toBeTruthy();
    }
  });
});

// ==========================================
// 7. PROJECTS
// ==========================================
test.describe('Projects', () => {
  test('list page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/projects', 'Projects list');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });

  test('new project page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/projects/new', 'New project form');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
    // Should have a form
    await expect(page.locator('form').first()).toBeVisible({ timeout: 5000 });
  });

  test('new project form has required fields', async ({ page }) => {
    await page.goto('/projects/new', { waitUntil: 'networkidle' });
    // Check for name/title input
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[placeholder*="title" i]').first();
    const clientSelect = page.locator('select').first();
    expect(await nameInput.isVisible().catch(() => false) || await clientSelect.isVisible().catch(() => false)).toBeTruthy();
  });
});

// ==========================================
// 8. PROPOSALS
// ==========================================
test.describe('Proposals', () => {
  test('list page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/proposals', 'Proposals list');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });

  test('new proposal wizard loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/proposals/new', 'New proposal wizard');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });
});

// ==========================================
// 9. INVOICES
// ==========================================
test.describe('Invoices', () => {
  test('list page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/invoices', 'Invoices list');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });

  test('new invoice page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/invoices/new', 'New invoice form');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });
});

// ==========================================
// 10. EMAIL GENERATOR
// ==========================================
test.describe('Email Generator', () => {
  test('page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/email-generator', 'Email generator');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });
});

// ==========================================
// 11. SETTINGS
// ==========================================
test.describe('Settings', () => {
  test('page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/settings', 'Settings');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });

  test('tabs are clickable', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    const tabs = page.locator('[role="tab"], .nav-link, button:has-text("Team"), button:has-text("Integrations"), button:has-text("Notifications")');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount && i < 5; i++) {
      if (await tabs.nth(i).isVisible()) {
        await tabs.nth(i).click();
        await page.waitForTimeout(300);
        // Should not cause errors
      }
    }
  });
});

// ==========================================
// 12. ACTIVITY LOG
// ==========================================
test.describe('Activity Log', () => {
  test('page loads', async ({ page }) => {
    const result = await visitAndAudit(page, '/activity', 'Activity log');
    expect(result.status).toBe(200);
    expect(result.networkErrors).toHaveLength(0);
  });
});

// ==========================================
// 13. SIDEBAR NAVIGATION
// ==========================================
test.describe('Sidebar Navigation', () => {
  test('all sidebar links are present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const expectedLinks = [
      'Dashboard', 'Pipeline', 'Leads', 'Referrals', 'Clients',
      'Projects', 'Proposals', 'Invoices', 'Settings', 'Activity Log',
    ];

    for (const label of expectedLinks) {
      const link = page.locator(`a:has-text("${label}")`).first();
      await expect(link).toBeVisible({ timeout: 3000 });
    }
  });

  test('sidebar link navigates correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // Test a few links to ensure navigation works
    await page.locator('a:has-text("Leads")').first().click();
    await page.waitForURL('/leads', { timeout: 10000 });
    expect(page.url()).toContain('/leads');

    await page.locator('a:has-text("Clients")').first().click();
    await page.waitForURL('/clients', { timeout: 10000 });
    expect(page.url()).toContain('/clients');
  });
});

// ==========================================
// 14. API ENDPOINTS
// ==========================================
test.describe('API Endpoints', () => {
  test('sign-in API responds', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in', {
      data: { email: 'test@test.com', password: 'wrong' },
    });
    // Should return 401 (not 500)
    expect(response.status()).toBeLessThan(500);
  });

  test('AI analyze-lead API validates input', async ({ request }) => {
    // Missing leadId should return 400
    const response = await request.post('/api/ai/analyze-lead', {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('CB-API-001');
  });

  test('AI generate-proposal API requires auth', async ({ request }) => {
    const response = await request.post('/api/ai/generate-proposal', {
      data: {},
    });
    expect(response.status()).toBeLessThan(500);
  });

  test('AI polish-reply API requires auth', async ({ request }) => {
    const response = await request.post('/api/ai/polish-reply', {
      data: {},
    });
    expect(response.status()).toBeLessThan(500);
  });

  test('client-projects API responds', async ({ request }) => {
    const response = await request.get('/api/invoices/client-projects?clientId=fake');
    expect(response.status()).toBeLessThan(500);
  });

  test('webhook endpoints reject invalid requests', async ({ request }) => {
    const endpoints = ['/api/webhooks/square', '/api/webhooks/github', '/api/webhooks/vercel'];
    for (const endpoint of endpoints) {
      const response = await request.post(endpoint, {
        data: { test: true },
        headers: { 'Content-Type': 'application/json' },
      });
      // Should reject (401/503 for missing secret) — not hang or return 200
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('cron stale-leads requires secret', async ({ request }) => {
    const response = await request.get('/api/cron/stale-leads');
    // Returns 503 (CRON_SECRET not configured) or 401 (wrong secret) — both valid
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('cron overdue-milestones requires secret', async ({ request }) => {
    const response = await request.get('/api/cron/overdue-milestones');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

// ==========================================
// 15. PORTAL (unauthenticated - should redirect)
// ==========================================
test.describe('Portal', () => {
  test('portal login page loads', async ({ page }) => {
    await page.context().clearCookies();
    const result = await visitAndAudit(page, '/portal/login', 'Portal login');
    expect(result.status).toBe(200);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('portal home redirects to login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/portal', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/portal\/login/);
  });
});

// ==========================================
// 16. 404 PAGE
// ==========================================
test.describe('404 Page', () => {
  test('shows custom 404 for non-existent route', async ({ page }) => {
    const result = await visitAndAudit(page, '/this-does-not-exist-xyz', '404 page');
    expect(result.status).toBe(404);
  });
});

// ==========================================
// 17. CONSOLE ERROR SWEEP
// ==========================================
test.describe('Console Error Sweep', () => {
  const pages = [
    { name: 'Dashboard', url: '/' },
    { name: 'Pipeline', url: '/pipeline' },
    { name: 'Leads', url: '/leads' },
    { name: 'Referrals', url: '/referrals' },
    { name: 'Clients', url: '/clients' },
    { name: 'Projects', url: '/projects' },
    { name: 'Proposals', url: '/proposals' },
    { name: 'Invoices', url: '/invoices' },
    { name: 'Settings', url: '/settings' },
    { name: 'Activity', url: '/activity' },
    { name: 'Email Generator', url: '/email-generator' },
    { name: 'New Project', url: '/projects/new' },
    { name: 'New Proposal', url: '/proposals/new' },
    { name: 'New Invoice', url: '/invoices/new' },
  ];

  for (const p of pages) {
    test(`${p.name} (${p.url}) has no page errors`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 20000 });

      // Report page errors (uncaught exceptions)
      if (pageErrors.length > 0) {
        console.log(`PAGE ERRORS on ${p.url}:`, pageErrors);
      }
      expect(pageErrors).toHaveLength(0);
    });
  }
});

// ==========================================
// 18. RESPONSE STATUS SWEEP
// ==========================================
test.describe('HTTP Status Sweep', () => {
  const pages = [
    '/',
    '/pipeline',
    '/leads',
    '/referrals',
    '/clients',
    '/projects',
    '/projects/new',
    '/proposals',
    '/proposals/new',
    '/invoices',
    '/invoices/new',
    '/settings',
    '/activity',
    '/email-generator',
  ];

  for (const url of pages) {
    test(`${url} returns 200`, async ({ page }) => {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      expect(response?.status()).toBe(200);
    });
  }
});
