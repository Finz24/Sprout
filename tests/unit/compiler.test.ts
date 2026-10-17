import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

test('a failed project build emits no files outside its output directory', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sprout-compiler-'));
  try {
    mkdirSync(join(directory, 'src'));
    writeFileSync(join(directory, 'outside.ts'), 'export const value = 1;');
    writeFileSync(
      join(directory, 'src/index.ts'),
      "export { value } from '../outside.js';",
    );
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: resolve('tsconfig.base.json'),
        compilerOptions: { rootDir: 'src', outDir: 'dist', types: [] },
        include: ['src'],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [resolve('node_modules/typescript/bin/tsc'), '-p', directory],
      { encoding: 'utf8', timeout: 20000, windowsHide: true },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('TS6059');
    expect(existsSync(join(directory, 'outside.js'))).toBe(false);
    expect(existsSync(join(directory, 'outside.d.ts'))).toBe(false);
    expect(existsSync(join(directory, 'dist/index.js'))).toBe(false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
