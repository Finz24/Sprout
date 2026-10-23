import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const owner = {
  name: process.env.SPROUT_OWNER_NAME ?? 'Sprout Owner',
  email: process.env.SPROUT_TEST_EMAIL ?? 'owner@example.invalid',
  password: process.env.SPROUT_TEST_PASSWORD ?? 'synthetic-password-for-tests',
};

async function signIn(page: Page, path = '/login', heading = 'Library') {
  await page.goto(path);
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: heading, exact: true }),
  ).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test('returns to the requested private page and keeps the session cookie host-only and HttpOnly', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, '/settings', 'Settings');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText(owner.name)).toBeVisible();
  await expect(page.getByText(owner.email)).toBeVisible();
  await page.reload();
  await expect(page.getByText(owner.email)).toBeVisible();
  const cookie = (await context.cookies()).find(
    (value) => value.name === 'sprout.session_token',
  );
  expect(cookie).toBeDefined();
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(cookie?.secure).toBe(false);
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000);
  expect(errors).toEqual([]);
  await noHorizontalOverflow(page);
});

test('persists the library view across reload and settings navigation', async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole('link', { name: /sign up|register/i }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Your library is ready for a fresh start'),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('library.png'),
    fullPage: true,
  });
  const grid = page.getByRole('button', { name: 'Grid' });
  const list = page.getByRole('button', { name: 'List' });
  await grid.click();
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  await list.click();
  await expect(list).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toBeVisible();
  await expect(list).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/settings');
  await expect(list).toHaveAttribute('aria-pressed', 'true');
  await grid.click();
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/library');
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
});

test('keeps placeholders honest and preserves search in the URL', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/library/items/missing-item');
  await expect(
    page.getByRole('heading', { name: 'Item not found' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Close item' }).click();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toBeVisible();
  await page.goto('/search?q=needle');
  await expect(
    page.getByText(/Your query.*needle.*kept in this URL/),
  ).toBeVisible();
  expect(page.url()).toContain('q=needle');
  await page.goto('/spaces');
  await expect(page.getByRole('heading', { name: 'Spaces' })).toBeVisible();
  await page.goto('/spaces/unknown');
  await expect(
    page.getByRole('heading', { name: 'Space unavailable' }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});

test('opens and closes the mobile navigation drawer with Escape and restores focus', async ({
  page,
}) => {
  await signIn(page);
  const menu = page.getByRole('button', { name: 'Menu' });
  if (test.info().project.name === 'desktop') {
    await expect(menu).toBeHidden();
    return;
  }
  const box = await menu.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await menu.click();
  const dialog = page.getByRole('dialog', { name: 'Navigation' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Settings' })).toBeVisible();
  for (const target of await dialog.locator('button, a').all()) {
    const size = await target.boundingBox();
    expect(size?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(size?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  for (let tab = 0; tab < 8; tab++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
  await noHorizontalOverflow(page);
});

test('hides private state on cross-tab sign-out failure and completes the retry', async ({
  page,
  context,
}) => {
  await signIn(page);
  const second = await context.newPage();
  await second.goto('/library');
  await expect(
    second.getByRole('heading', { name: 'Library', exact: true }),
  ).toBeVisible();
  await page.route('**/api/auth/sign-out', (route) => route.abort());
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign out needs a retry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toHaveCount(0);
  await expect(
    second.getByRole('heading', { name: 'Sign out needs a retry' }),
  ).toBeVisible();
  await page.unroute('**/api/auth/sign-out');
  await page.getByRole('button', { name: 'Retry sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(second).toHaveURL(/\/login/);
  await expect(
    second.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
});

test('keyboard search survives reload and browser back with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  await page
    .getByRole('searchbox', { name: 'Find and ask' })
    .fill('recipe needle');
  await page.getByRole('searchbox', { name: 'Find and ask' }).press('Enter');
  await expect(page).toHaveURL(/\/search\?q=recipe(?:%20|\+)needle$/);
  await expect(
    page.getByRole('heading', { name: 'Find and ask' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/recipe needle.*kept in this URL/)).toBeVisible();
  await page.goto('/settings');
  await page.goBack();
  await expect(page.getByText(/recipe needle.*kept in this URL/)).toBeVisible();
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole('button', { name: 'Search', exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s');
});

test('rejects external, encoded, login-loop and credential-bearing return destinations', async ({
  page,
}) => {
  await signIn(page);
  for (const destination of [
    'https://attacker.invalid',
    '//attacker.invalid',
    '/\\attacker.invalid',
    '/login',
    '/%2f%2fattacker.invalid',
    '/settings?password=do-not-retain',
  ]) {
    await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
    await expect(page).toHaveURL(
      destination.startsWith('/settings?') ? /\/settings$/ : /\/library$/,
    );
    await expect(page.locator('input[type=password]')).toHaveCount(0);
  }
});

test('failed API reads and sign-in expose retry states without private content', async ({
  page,
}) => {
  await page.route('**/api/auth/sign-in/email', (route) => route.abort());
  await page.goto('/login');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Sign in is unavailable',
  );
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/auth/sign-in/email');
  await signIn(page);
  await page.route('**/api/shell', (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Sprout is unavailable' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/shell');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toBeVisible();
});

test('a late preference response cannot restore private UI after sign-out', async ({
  page,
}) => {
  await signIn(page, '/settings', 'Settings');
  let release = () => {};
  let received = () => {};
  const arrived = new Promise<void>((resolve) => {
    received = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finished = () => {};
  const delivered = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route('**/api/settings/library-view', async (route) => {
    const response = await route.fetch();
    received();
    await wait;
    await route
      .fulfill({ response })
      .catch(() => undefined)
      .finally(finished);
  });
  await page.getByRole('button', { name: 'List' }).click();
  await arrived;
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  release();
  await delivered;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
  await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
});

test('anonymous and unavailable deep links never mount private content', async ({
  page,
}) => {
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('.app-shell'))
        document.documentElement.dataset.privateShellSeen = 'true';
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
  expect(
    await page.locator('html').getAttribute('data-private-shell-seen'),
  ).toBeNull();
  await page.route('**/api/session', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'Unavailable' }),
    }),
  );
  await page.goto('/library/items/unavailable');
  await expect(
    page.getByRole('heading', { name: 'Sprout is unavailable' }),
  ).toBeVisible();
  expect(
    await page.locator('html').getAttribute('data-private-shell-seen'),
  ).toBeNull();
  await page.unroute('**/api/session');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible();
});
