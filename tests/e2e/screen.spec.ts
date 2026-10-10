import { expect, test } from '@playwright/test';

test('navigates the empty library, search and inspector with keyboard and touch', async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Email').fill('owner@sprout.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.SPROUT_TEST_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your library' }),
  ).toBeVisible();
  await expect(
    page.getByText('Your library is empty.', { exact: false }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole('button', { name: 'Menu', exact: true }).tap();
  const search = page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('link', { name: 'Search', exact: true });
  if (isMobile) await search.tap();
  else {
    await search.focus();
    await page.keyboard.press('Enter');
  }
  await expect(
    page.getByRole('heading', { name: 'Search your library' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('recipe');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('status')).toHaveText(
    'No saved items to search for recipe.',
  );
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('recipe');
  if (isMobile) {
    await page.getByRole('button', { name: 'Menu', exact: true }).tap();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Inspector', exact: true })
      .tap();
  } else {
    const inspector = page
      .getByRole('navigation')
      .getByRole('link', { name: 'Inspector', exact: true });
    await inspector.focus();
    await page.keyboard.press('Enter');
  }
  await expect(
    page.getByRole('heading', { name: 'No item selected' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'No item selected' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to library' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your library' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (isMobile) {
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await menu.tap();
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Library', exact: true })
      .focus();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
  }
});
