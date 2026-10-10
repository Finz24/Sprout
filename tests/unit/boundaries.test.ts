import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
// @ts-expect-error The dependency checker is also a standalone Node script.
import { checkBoundaries } from '../../scripts/check-boundaries.mjs';

const folders: string[] = [];
it('keeps contracts safe for browser consumers', () => {
  expect(
    checkBoundaries(
      fixture({ 'packages/contracts/src/index.ts': "import 'node:fs';" }),
    ),
  ).toContain('packages/contracts/src/index.ts: server dependency in browser');
});
it('forbids bare Node built-ins in browser code', () => {
  expect(
    checkBoundaries(fixture({ 'apps/web/src/main.ts': "import 'fs';" })),
  ).toContain('apps/web/src/main.ts: server dependency in browser');
});
it('detects JavaScript-style relative imports of TSX in cycles', () => {
  expect(
    checkBoundaries(
      fixture({
        'packages/ui/src/a.tsx': "import './b.js';",
        'packages/ui/src/b.tsx': "import './a.js';",
      }),
    ),
  ).toEqual([expect.stringContaining('Import cycle')]);
});
it('forbids package internals and cross-project relative imports', () => {
  expect(
    checkBoundaries(
      fixture({
        'apps/web/src/main.ts':
          "import '@sprout/ui/src/button'; import '../../../packages/ui/src/index.js';",
        'packages/ui/src/index.ts': "export const button = 'button';",
      }),
    ),
  ).toEqual(
    expect.arrayContaining([
      'apps/web/src/main.ts: forbidden dependency @sprout/ui/src/button',
      'apps/web/src/main.ts: cross-project imports must use public package exports',
    ]),
  );
});
afterEach(() => {
  for (const folder of folders.splice(0))
    fs.rmSync(folder, { recursive: true, force: true });
});
function fixture(files: Record<string, string>) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sprout-boundary-'));
  folders.push(folder);
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(folder, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return folder;
}
it('forbids a browser importing a backend package', () => {
  expect(
    checkBoundaries(
      fixture({ 'apps/web/src/main.ts': "import '@sprout/database';" }),
    ),
  ).toContain('apps/web/src/main.ts: forbidden dependency @sprout/database');
});
it('detects a relative import cycle', () => {
  expect(
    checkBoundaries(
      fixture({
        'packages/ui/src/a.ts': "import './b.js';",
        'packages/ui/src/b.ts': "import './a.js';",
      }),
    ),
  ).toEqual([expect.stringContaining('Import cycle')]);
});
it('allows browser access through the UI public interface', () => {
  expect(
    checkBoundaries(
      fixture({
        'apps/web/src/main.ts': "import '@sprout/ui';",
        'packages/ui/src/index.ts': "export const button = 'button';",
      }),
    ),
  ).toEqual([]);
});
