import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Pool } from 'pg';

async function signIn(page: Page, email = 'owner@sprout.test') {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.SPROUT_TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your library' }),
  ).toBeVisible();
}

test('a delayed real workspace response cannot restore the shell after logout', async ({
  page,
  isMobile,
}) => {
  await signIn(page);
  if (isMobile)
    await page.getByRole('button', { name: 'Menu', exact: true }).tap();
  let markFetched = () => {};
  let release = () => {};
  const fetched = new Promise<void>((resolve) => {
    markFetched = resolve;
  });
  const delivery = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/private/workspace', async (route) => {
    // Delay transport only: the body and authorization come from the real API/PG.
    const response = await route.fetch();
    markFetched();
    await delivery;
    await route.fulfill({ response }).catch(() => undefined);
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await fetched;
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in to Sprout' }),
  ).toBeVisible();
  release();
  await page.unrouteAll({ behavior: 'wait' });
  // Let the released response's browser task/React render settle before checking.
  await page.waitForTimeout(150);
  await expect(
    page.getByRole('heading', { name: 'Sign in to Sprout' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your library' })).toHaveCount(
    0,
  );
});

test('signs in, survives reload and denies another owner workspace', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Sign in to Sprout' }),
  ).toBeVisible();
  await page.getByLabel('Email').fill('owner@sprout.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.SPROUT_TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your library' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your library' }),
  ).toBeVisible();
  const status = await page.evaluate(
    async () => (await fetch('/api/private/workspaces/other-owner')).status,
  );
  expect(status).toBe(404);
});

test('logout revokes private access after reload and public signup stays closed', async ({
  page,
  isMobile,
}) => {
  await signIn(page);
  const cookies = await page.context().cookies();
  const cookie = cookies
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  if (isMobile)
    await page.getByRole('button', { name: 'Menu', exact: true }).tap();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Sign in to Sprout' }),
  ).toBeVisible();
  const revoked = await page.request.get('/api/private/workspace', {
    headers: { Cookie: cookie },
  });
  expect(revoked.status()).toBe(401);
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: process.env.WEB_URL ?? 'http://127.0.0.1:5173' },
    data: {
      email: 'public@sprout.test',
      name: 'Public',
      password: process.env.SPROUT_TEST_PASSWORD,
    },
  });
  expect(signup.status()).toBe(400);
  expect((await signup.json()).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED');
});

test('expired sessions disappear on reload and private operations reject them', async ({
  page,
}) => {
  await signIn(page, 'other@sprout.test');
  // Control persisted session time, then observe the real auth and application response.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const current = await page.request.get('/api/auth/get-session');
  const sessionId = (await current.json()).session.id as string;
  try {
    await pool.query('UPDATE session SET "expiresAt" = $1 WHERE id = $2', [
      new Date('2000-01-01T00:00:00Z'),
      sessionId,
    ]);
  } finally {
    await pool.end();
  }
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Sign in to Sprout' }),
  ).toBeVisible();
  expect((await page.request.get('/api/private/workspace')).status()).toBe(401);
});

test('identity headers and worker requests cannot impersonate a signed-in owner', async ({
  page,
  request,
}) => {
  await page.goto('/inspector');
  await expect(
    page.getByRole('heading', { name: 'Sign in to Sprout' }),
  ).toBeVisible();
  const response = await request.get('/api/private/workspace', {
    headers: {
      'x-user-id': 'other-owner',
      'x-owner-id': 'other-owner',
      'x-worker-id': 'worker',
    },
  });
  expect(response.status()).toBe(401);
  const worker = await fetch(
    `${process.env.WORKER_URL ?? 'http://127.0.0.1:3002'}/private/workspaces/other-owner`,
    { headers: { 'x-user-id': 'other-owner' } },
  );
  expect(worker.status).toBe(404);
});

test('alternating concurrent owners remain isolated with pooled connection reuse', async ({
  browser,
}) => {
  const alice = await browser.newContext();
  const bob = await browser.newContext();
  try {
    const a = await alice.newPage();
    const b = await bob.newPage();
    await signIn(a);
    await signIn(b, 'other@sprout.test');
    for (let round = 0; round < 4; round++) {
      const responses = await Promise.all([
        a.request.get('/api/private/workspace'),
        b.request.get('/api/private/workspace'),
        a.request.get('/api/private/workspaces/other-owner'),
        b.request.get(
          `/api/private/workspaces/${process.env.SPROUT_TEST_OWNER_ID}`,
        ),
      ] as const);
      expect(responses.map((response) => response.status())).toEqual([
        200, 200, 404, 404,
      ]);
      expect((await responses[0].json()).owner.name).toBe('Synthetic owner');
      expect((await responses[1].json()).owner.name).toBe(
        'Synthetic second owner',
      );
    }
  } finally {
    await alice.close();
    await bob.close();
  }
});
