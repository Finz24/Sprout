import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const base = process.env.NX_BASE ?? 'main';
const exists =
  spawnSync('git', ['rev-parse', '--verify', `${base}^{commit}`], {
    stdio: 'ignore',
  }).status === 0;
const args = exists
  ? ['affected', '-t', 'typecheck,build', `--base=${base}`, '--parallel=3']
  : ['run-many', '-t', 'typecheck,build', '--parallel=3'];
if (!exists) console.log('Base revision unavailable; checking every project.');
const require = createRequire(import.meta.url);
const nx = path.join(
  path.dirname(require.resolve('nx/package.json')),
  'dist/bin/nx.js',
);
const result = spawnSync(process.execPath, [nx, ...args], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
