// @ts-check
const { test, expect } = require('@playwright/test');

const AUTH_FILE = './e2e/.auth/user.json';

test('authenticate', async ({ page }) => {
  test.setTimeout(60000);

  // Sign in via Supabase API directly, then set cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Get auth tokens from Supabase
  const authResponse = await page.request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      data: {
        email: 'dessiah@m.botmakers.ai',
        password: 'Botmakers2026!',
      },
    }
  );

  const authData = await authResponse.json();

  if (!authData.access_token) {
    throw new Error(`Auth failed: ${JSON.stringify(authData)}`);
  }

  // Navigate to the app and set the Supabase auth cookies via JS
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Set Supabase session in localStorage/cookies via the browser client
  await page.evaluate(({ url, key, accessToken, refreshToken }) => {
    const { createBrowserClient } = require('@supabase/ssr');
    // Store tokens in the format Supabase SSR expects
    const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    // Supabase SSR stores in cookies — set them
    document.cookie = `${storageKey}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=3600`;
  }, {
    url: supabaseUrl,
    key: supabaseKey,
    accessToken: authData.access_token,
    refreshToken: authData.refresh_token,
  }).catch(() => {
    // require() won't work in browser — set cookie directly
  });

  // Set the auth cookie in the format @supabase/ssr expects
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionData = JSON.stringify({
    access_token: authData.access_token,
    refresh_token: authData.refresh_token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: authData.user,
  });

  // Supabase SSR splits large cookies into chunks
  const encoded = sessionData;
  const chunkSize = 3180;
  const chunks = [];
  for (let i = 0; i < encoded.length; i += chunkSize) {
    chunks.push(encoded.substring(i, i + chunkSize));
  }

  const cookieBase = {
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  };

  if (chunks.length === 1) {
    await page.context().addCookies([
      { ...cookieBase, name: cookieName, value: chunks[0] },
    ]);
  } else {
    const cookies = chunks.map((chunk, i) => ({
      ...cookieBase,
      name: `${cookieName}.${i}`,
      value: chunk,
    }));
    await page.context().addCookies(cookies);
  }

  // Navigate to dashboard to verify auth works
  await page.goto('/', { waitUntil: 'networkidle', timeout: 20000 });

  // Should not redirect to sign-in
  expect(page.url()).not.toContain('sign-in');

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE });
});
