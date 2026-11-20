import { expect, test } from '@playwright/test';

test('shows the real Turnstile widget only after the backend threshold', async ({ page }) => {
  const turnstileFailures = [];
  let loginApiOrigin;
  page.on('requestfailed', (request) => {
    if (request.url().includes('challenges.cloudflare.com')) {
      turnstileFailures.push(`${request.url()} :: ${request.failure()?.errorText || 'unknown'}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') turnstileFailures.push(`console :: ${message.text()}`);
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('browser-login-probe@example.invalid');
  await page.locator('input[name="password"]').fill('wrong-value');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    const response = await responsePromise;
    loginApiOrigin ??= new URL(response.url()).origin;
    expect(response.status()).toBe(401);
    if (attempt < 3) {
      await expect(page.getByTestId('turnstile-container')).toHaveCount(0);
    } else {
      expect((await response.json()).code).toBe('LOGIN_CHALLENGE_REQUIRED');
    }
  }

  await expect(page.getByText('Vui lòng xác minh để thử đăng nhập lại.').first()).toBeVisible();
  await expect(page.getByTestId('turnstile-container')).toBeVisible();
  try {
    await expect.poll(() => page.evaluate(() => typeof window.turnstile?.render === 'function'), {
      timeout: 15_000
    }).toBe(true);
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled({ timeout: 15_000 });
  } catch (error) {
    throw new Error(`Turnstile did not render. ${turnstileFailures.join(' | ') || 'No browser error was reported.'}`, { cause: error });
  }

  const probeStatuses = await page.evaluate(async ({ apiOrigin }) => {
    const csrfToken = decodeURIComponent(document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('XSRF-TOKEN='))
      ?.split('=')[1] || '');
    const statuses = [];
    for (let index = 0; index < 17; index += 1) {
      const response = await fetch(`${apiOrigin}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
        body: JSON.stringify({
          email: 'browser-login-probe@example.invalid',
          password: 'wrong-value',
          tutorMode: false
        })
      });
      statuses.push(response.status);
    }
    return statuses;
  }, { apiOrigin: loginApiOrigin });
  expect(probeStatuses).toHaveLength(17);
  expect(probeStatuses).not.toContain(429);

  const limitedResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  const limitedResponse = await limitedResponsePromise;
  expect(limitedResponse.status()).toBe(429);
  expect(Number(limitedResponse.headers()['retry-after'])).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: /Thử lại sau \d+ giây/ })).toBeDisabled();
});
