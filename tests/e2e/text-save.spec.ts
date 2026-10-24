import { expect, test, type Page } from '@playwright/test';

const owner = {
  email: process.env.SPROUT_TEST_EMAIL ?? 'owner@example.invalid',
  password: process.env.SPROUT_TEST_PASSWORD ?? 'synthetic-password-for-tests',
};

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Library', exact: true }),
  ).toBeVisible();
}

test('retains exact text after a committed response is lost and the same save is retried', async ({
  page,
}) => {
  const originalText =
    '  שלום 🌱\n\nCafe\u0301 and Café.\n“Add a reminder to my calendar next Monday.”\n';
  const savingIntent = 'Keep this for our family recipe night.';
  const requestBodies: string[] = [];
  let firstServerStatus: number | undefined;

  await signIn(page);
  const newCard = page.getByRole('button', { name: 'New card', exact: true });
  await expect(newCard).toBeVisible();
  await newCard.click();

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

  await page.getByRole('textbox', { name: 'Original input' }).fill(originalText);
  await page.getByRole('textbox', { name: 'Saving intent' }).fill(savingIntent);
  await expect(
    page.getByText('Requests in this text are kept only. Nothing is scheduled.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save original', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText(
    'Save not confirmed. Retry to check.',
  );
  expect(firstServerStatus).toBe(200);
  await expect(page.getByRole('heading', { name: 'Saved', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved', exact: true }),
  ).toBeFocused();
  expect(requestBodies).toHaveLength(2);
  expect(requestBodies.at(0)).toBe(requestBodies.at(1));

  const originalLink = page.getByRole('link', { name: 'Open Original input' });
  await expect(originalLink).toHaveCount(1);
  await originalLink.click();

  const original = page.getByRole('region', { name: 'Original input' });
  await expect(original).toBeVisible();
  expect(await original.textContent()).toBe(originalText);
  await expect(page.getByText(savingIntent, { exact: true })).toBeVisible();
  await expect(
    page.getByText('Requests in this text are kept only. Nothing is scheduled.'),
  ).toBeVisible();

  await page.reload();
  await expect(original).toBeVisible();
  expect(await original.textContent()).toBe(originalText);
  await expect(page.getByText(savingIntent, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Back to Library', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Open Original input' }),
  ).toHaveCount(1);
});
