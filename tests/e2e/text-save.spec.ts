import { expect, test, type Page } from '@playwright/test';

const owner = {
  email: process.env.SPROUT_TEST_EMAIL ?? 'owner@example.invalid',
  password: process.env.SPROUT_TEST_PASSWORD ?? 'synthetic-password-for-tests',
};

const originalText =
  '  שלום 🌱\n\nCafe\u0301 and Café.\n“Add a reminder to my calendar next Monday.”\n';
const savingIntent = 'Keep this for our family recipe night.';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toBeVisible();
}

async function openComposer(page: Page) {
  const newCard = page.getByRole('button', { name: 'New card', exact: true });
  await expect(newCard).toBeVisible();
  await newCard.click();
  await expect(page.getByLabel('Original input')).toBeVisible();
  await expect(page.getByLabel('Original input')).toHaveAttribute(
    'dir',
    'auto',
  );
}

test('retains exact text after a committed response is lost and the same save is retried', async ({
  page,
}) => {
  const requestBodies: string[] = [];
  let firstServerStatus: number | undefined;

  await signIn(page);
  await openComposer(page);

  await page.route('**/api/library/text', async (route) => {
    requestBodies.push(route.request().postData() ?? '');
    const response = await route.fetch();
    if (requestBodies.length === 1) {
      firstServerStatus = response.status();
      await route.abort('failed');
      return;
    }
    await route.fulfill({ response });
  });

  await page
    .getByRole('textbox', { name: 'Original input' })
    .fill(originalText);
  await page.getByRole('textbox', { name: 'Saving intent' }).fill(savingIntent);
  await expect(
    page.getByText(
      'Requests in this text are kept only. Nothing is scheduled.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Save original', exact: true })
    .click();

  await expect(page.getByRole('alert')).toContainText(
    'Save not confirmed. Retry to check.',
  );
  expect(firstServerStatus).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('textbox', { name: 'Saving intent' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toBeFocused();
  expect(requestBodies).toHaveLength(2);
  expect(requestBodies.at(0)).toBe(requestBodies.at(1));
  await expect(
    page
      .getByRole('region', { name: 'New card' })
      .getByText(originalText, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy text' })).toBeVisible();
  await expect(
    page.getByText(
      'Requests in this text are kept only. Nothing is scheduled.',
    ),
  ).toBeVisible();

  const originalLink = page.getByRole('link', { name: 'Open Original input' });
  await expect(originalLink).toHaveCount(1);
  await originalLink.click();

  const original = page.getByRole('region', { name: 'Original input' });
  await expect(original).toBeVisible();
  expect(await original.textContent()).toBe(originalText);
  await expect(page.getByText(savingIntent, { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      'Requests in this text are kept only. Nothing is scheduled.',
    ),
  ).toBeVisible();

  await page.reload();
  await expect(original).toBeVisible();
  expect(await original.textContent()).toBe(originalText);
  await expect(page.getByText(savingIntent, { exact: true })).toBeVisible();

  await page
    .getByRole('link', { name: 'Back to Library', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open Original input' }),
  ).toHaveCount(1);
});

test('does not send an offline first save and names the reconnect step', async ({
  page,
  context,
}) => {
  const bodies: string[] = [];
  await page.route('**/api/library/text', async (route) => {
    bodies.push(route.request().postData() ?? '');
    await route.continue();
  });
  await signIn(page);
  await openComposer(page);
  await page
    .getByRole('textbox', { name: 'Original input' })
    .fill(originalText);
  await context.setOffline(true);
  await page
    .getByRole('button', { name: 'Save original', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'You are offline. Reconnect, then save this original.',
  );
  expect(bodies).toEqual([]);
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toBeEnabled();
});

test('returns a 400 to an editable draft without changing the original', async ({
  page,
}) => {
  await signIn(page);
  await openComposer(page);
  await page.route('**/api/library/text', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: '{}',
    }),
  );
  await page
    .getByRole('textbox', { name: 'Original input' })
    .fill(originalText);
  await page.getByRole('textbox', { name: 'Saving intent' }).fill(savingIntent);
  await page
    .getByRole('button', { name: 'Save original', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Enter valid text to save. The original stays unchanged.',
  );
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toHaveValue(originalText);
  await expect(
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toHaveCount(0);
});

test('offers a confirmed new save after a 409 without editing the winner', async ({
  page,
}) => {
  await signIn(page);
  await openComposer(page);
  await page.route('**/api/library/text', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: '{}',
    }),
  );
  await page
    .getByRole('textbox', { name: 'Original input' })
    .fill(originalText);
  await page
    .getByRole('button', { name: 'Save original', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'This save identity already holds different text.',
  );
  await page
    .getByRole('button', { name: 'Start a new save', exact: true })
    .click();
  await expect(
    page.getByText(
      'This save may already be in your library. A new save can keep a second copy.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Start a new save', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toHaveValue('');
});

test('asks before leaving a dirty composer and keeps the draft when staying', async ({
  page,
}) => {
  await signIn(page);
  await openComposer(page);
  await page
    .getByRole('textbox', { name: 'Original input' })
    .fill(originalText);
  await page.getByRole('searchbox', { name: 'Find and ask' }).fill('leave');
  await page.getByRole('searchbox', { name: 'Find and ask' }).press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    'Leave without a confirmed save?',
  );
  await page.getByRole('button', { name: 'Stay here', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Original input' }),
  ).toHaveValue(originalText);
  await expect(page).toHaveURL(/\/library/);
});

test('finds a saved original by a literal substring and returns from search', async ({
  page,
}) => {
  const unique = `literal-%_\\ needle ${Date.now()}`;
  await signIn(page);
  await openComposer(page);
  await page.getByRole('textbox', { name: 'Original input' }).fill(unique);
  await page
    .getByRole('button', { name: 'Save original', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find and ask' }).fill(unique);
  await page.getByRole('searchbox', { name: 'Find and ask' }).press('Enter');
  expect(new URL(page.url()).searchParams.get('q')).toBe(unique);
  await page.getByRole('link', { name: unique }).click();
  const original = page.getByRole('region', { name: 'Original input' });
  expect(await original.textContent()).toBe(unique);
  await page.getByRole('link', { name: 'Back to search', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Find and ask', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: 'Text in an original' }),
  ).toHaveValue(unique);
});
