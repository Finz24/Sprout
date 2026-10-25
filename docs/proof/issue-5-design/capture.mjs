import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const output = fileURLToPath(new URL('.', import.meta.url));
const sheet = fileURLToPath(
  new URL('../../design/issue-5-review.html', import.meta.url),
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
        originalUnicode: document.body.innerText.includes('200 g'),
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
    const overviewHeight = Math.min(details.height, 10000);
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      clip: { x: 0, y: 0, width: details.width, height: overviewHeight },
    });
    for (const kind of ['ready', 'failed']) {
      await page.locator(`#${kind}`).screenshot({
        path: path.join(output, `${name}-${kind}.png`),
      });
      for (const theme of ['light', 'dark']) {
        await page
          .locator(
            `#${kind} .screen.${theme}.${name === 'mobile' ? 'phone' : 'desktop'}`,
          )
          .first()
          .screenshot({
            path: path.join(output, `${name}-${kind}-${theme}.png`),
          });
      }
    }
    await page.locator('.motion-demo > summary').click();
    const reducedAnimation = await page
      .locator('.motion-scene')
      .evaluate((node) => getComputedStyle(node).animationName);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.motion-demo > summary').click();
    await page.locator('.motion-demo > summary').click();
    const normalAnimation = await page
      .locator('.motion-scene')
      .evaluate((node) => getComputedStyle(node).animationName);
    if (reducedAnimation !== 'none' || normalAnimation !== 'panel-reveal')
      throw new Error('Motion preference is not respected.');
    await page
      .locator('.motion-demo')
      .screenshot({ path: path.join(output, `${name}-motion.png`) });
    evidence.push({
      name,
      ...details,
      overviewHeight,
      reducedAnimation,
      normalAnimation,
      errors,
      external,
    });
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
