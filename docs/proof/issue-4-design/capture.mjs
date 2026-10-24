import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Run from any directory: node docs/proof/issue-4-design/capture.mjs
// Static review evidence only; this never starts or drives the product runtime.
const output = fileURLToPath(new URL('.', import.meta.url));
const sheet = fileURLToPath(
  new URL('../../design/issue-4-review.html', import.meta.url),
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const evidence = [];
try {
  for (const [name, options] of [
    [
      'desktop',
      { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
    ],
    ['mobile', { ...devices['Galaxy S9+'], deviceScaleFactor: 1 }],
  ]) {
    const context = await browser.newContext({
      ...options,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) external.push(request.url());
    });
    await page.goto(pathToFileURL(sheet).href);
    await page.evaluate(() => document.fonts.ready);
    const details = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
      return {
        width: innerWidth,
        contentWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        interLoaded: [...document.fonts].some(
          (font) => font.family === 'Inter' && font.status === 'loaded',
        ),
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        elementIds: ids.length,
        originalUnicode: [...document.querySelectorAll('textarea')].every(
          (field) =>
            field.value.includes('\u05e9\u05dc\u05d5\u05dd') &&
            field.value.includes('e\u0301'),
        ),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });
    if (
      details.contentWidth > details.width ||
      !details.interLoaded ||
      details.duplicateIds.length ||
      !details.originalUnicode ||
      errors.length ||
      external.length
    ) {
      throw new Error(JSON.stringify({ name, ...details, errors, external }));
    }
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      fullPage: true,
    });
    for (const direction of ['a', 'b', 'c']) {
      await page
        .locator(`#direction-${direction}`)
        .screenshot({ path: path.join(output, `${name}-${direction}.png`) });
    }
    await page
      .locator(
        name === 'mobile'
          ? '#direction-a .screen.light.phone'
          : '#direction-a .screen.light.desktop',
      )
      .first()
      .screenshot({ path: path.join(output, `${name}-a-light.png`) });
    await page
      .locator(
        name === 'mobile'
          ? '#direction-a .screen.dark.phone'
          : '#direction-a .screen.dark.desktop',
      )
      .first()
      .screenshot({ path: path.join(output, `${name}-a-dark.png`) });
    evidence.push({ name, ...details, errors, external });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  path.join(output, 'render-evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
