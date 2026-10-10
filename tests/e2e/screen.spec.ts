import { expect, test } from '@playwright/test';

test('renders the foundation page and preserves routing after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A place for what you want to keep.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'View foundation' }).click();
  await expect(page).toHaveURL(/\/foundation$/);
  await expect(
    page.getByRole('heading', { name: 'Development foundation' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Node / Effect', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Home', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'A place for what you want to keep.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
