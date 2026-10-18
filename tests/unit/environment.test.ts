import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const script = resolve('scripts/check-environment.mjs');
const directories: string[] = [];
const nodeVersion = process.versions.node;

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'sprout-environment-'));
  directories.push(directory);
  const files = {
    '.nvmrc': nodeVersion,
    'package.json': JSON.stringify({
      engines: { node: nodeVersion },
      packageManager: 'pnpm@10.34.6',
    }),
    '.npmrc':
      'save-exact=true\nstrict-peer-dependencies=true\nengine-strict=true\n',
    Dockerfile: `FROM node:${nodeVersion}-bookworm-slim@sha256:${'a'.repeat(64)}
RUN npm install --global corepack@0.36.0 && corepack prepare pnpm@10.34.6 --activate
`,
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(directory, name), content);
  }
  return { directory, files };
}

function preflight(
  directory: string,
  env: NodeJS.ProcessEnv = {},
  args: string[] = [],
) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: '',
      SPROUT_DB_PORT: '',
      SPROUT_API_PORT: '',
      SPROUT_WORKER_PORT: '',
      SPROUT_WEB_PORT: '',
      ...env,
    },
  });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  return result;
}

function resultChecks(stdout: string): unknown {
  const output: unknown = JSON.parse(stdout);
  if (typeof output !== 'object' || output === null || !('results' in output)) {
    throw new Error('Preflight must return named results.');
  }
  return output.results;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('static preflight accepts consistent pins without external commands', () => {
  const { directory } = fixture();
  const result = preflight(directory, { PATH: '' });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    results: [
      { name: 'arguments', status: 'pass' },
      { name: 'node-pin', status: 'pass' },
      { name: 'node-runtime', status: 'pass' },
      { name: 'package-manager', status: 'pass' },
      { name: 'package-config', status: 'pass' },
      { name: 'docker-pins', status: 'pass' },
      { name: 'compose-environment', status: 'pass' },
    ],
  });
});

test.each([
  { file: '.nvmrc', content: '>=24', name: 'node-pin' },
  { file: '.nvmrc', content: '0.0.1', name: 'node-runtime' },
  {
    file: 'package.json',
    content: JSON.stringify({
      engines: { node: '24.0.0' },
      packageManager: 'pnpm@10.34.6',
    }),
    name: 'node-pin',
  },
  {
    file: 'package.json',
    content: JSON.stringify({
      engines: { node: nodeVersion },
      packageManager: 'npm@10.34.6',
    }),
    name: 'package-manager',
  },
  {
    file: 'package.json',
    content: JSON.stringify({
      engines: { node: nodeVersion },
      packageManager: 'pnpm@latest',
    }),
    name: 'package-manager',
  },
  {
    file: '.npmrc',
    content:
      'save-exact=true\nstrict-peer-dependencies=true\nengine-strict=false',
    name: 'package-config',
  },
  { file: 'package.json', content: '{invalid', name: 'package-manager' },
])(
  'rejects invalid $file with a named $name failure',
  ({ file, content, name }) => {
    const { directory } = fixture();
    writeFileSync(join(directory, file), content);
    const result = preflight(directory);
    expect(result.status).toBe(1);
    expect(resultChecks(result.stdout)).toContainEqual(
      expect.objectContaining({ name, status: 'fail' }),
    );
  },
);

test.each([
  [
    'commented-only pins',
    (content: string) =>
      content.replace(/^RUN /m, '# RUN ') +
      '\nRUN npm install --global corepack@latest && corepack prepare pnpm@latest --activate\n',
  ],
  [
    'a later floating install',
    (content: string) =>
      content + '\nRUN corepack prepare pnpm@latest --activate\n',
  ],
  [
    'a later unversioned Corepack install',
    (content: string) => content + '\nRUN npm install --global corepack\n',
  ],
  [
    'an abbreviated unversioned Corepack install',
    (content: string) => content + '\nRUN npm i -g corepack\n',
  ],
  [
    'a direct floating pnpm install',
    (content: string) => content + '\nRUN npm install --global pnpm@latest\n',
  ],
])('rejects Docker %s', (_name, change) => {
  const { directory, files } = fixture();
  writeFileSync(join(directory, 'Dockerfile'), change(files.Dockerfile));
  const result = preflight(directory);
  expect(result.status).toBe(1);
  expect(resultChecks(result.stdout)).toContainEqual(
    expect.objectContaining({ name: 'docker-pins', status: 'fail' }),
  );
});

test.each([
  ['node-version', `node:${nodeVersion}`, 'node:0.0.1'],
  ['pnpm-version', 'pnpm@10.34.6', 'pnpm@10.34.5'],
  ['corepack-pin', 'corepack@0.36.0', 'corepack@latest'],
  ['base-digest', `@sha256:${'a'.repeat(64)}`, ''],
])('rejects Docker %s drift', (_name, before, after) => {
  const { directory, files } = fixture();
  writeFileSync(
    join(directory, 'Dockerfile'),
    files.Dockerfile.replace(before, after),
  );
  const result = preflight(directory);
  expect(result.status).toBe(1);
  expect(resultChecks(result.stdout)).toContainEqual(
    expect.objectContaining({ name: 'docker-pins', status: 'fail' }),
  );
});

test('accepts explicit isolated project and ports', () => {
  const { directory } = fixture();
  expect(
    preflight(directory, {
      COMPOSE_PROJECT_NAME: 'sprout-worktree-1',
      SPROUT_DB_PORT: '55439',
      SPROUT_API_PORT: '3103',
      SPROUT_WORKER_PORT: '3104',
      SPROUT_WEB_PORT: '5183',
    }).status,
  ).toBe(0);
});

test.each([
  { COMPOSE_PROJECT_NAME: 'Invalid/Project' },
  { SPROUT_DB_PORT: '0' },
  { SPROUT_API_PORT: '65536' },
  { SPROUT_WORKER_PORT: 'three' },
  { SPROUT_WEB_PORT: '3001' },
])('rejects an invalid project or host port set %j', (env) => {
  const { directory } = fixture();
  const result = preflight(directory, env);
  expect(result.status).toBe(1);
  expect(resultChecks(result.stdout)).toContainEqual(
    expect.objectContaining({ name: 'compose-environment', status: 'fail' }),
  );
});

test('reports missing prerequisite files without leaking their contents or environment', () => {
  const { directory } = fixture();
  rmSync(join(directory, 'Dockerfile'));
  writeFileSync(join(directory, 'package.json'), 'redaction-probe');
  const result = preflight(directory, { DATABASE_URL: 'redaction-probe' });
  expect(result.status).toBe(1);
  expect(result.stdout).not.toContain('redaction-probe');
  expect(resultChecks(result.stdout)).toContainEqual(
    expect.objectContaining({ name: 'docker-pins', status: 'fail' }),
  );
});

test('runtime mode fails when Docker and the browser dependency are unavailable', () => {
  const { directory } = fixture();
  const result = preflight(directory, { PATH: '' }, ['--runtime']);
  expect(result.status).toBe(1);
  expect(resultChecks(result.stdout)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'docker-daemon', status: 'fail' }),
      expect.objectContaining({ name: 'docker-compose', status: 'fail' }),
      expect.objectContaining({ name: 'playwright-browser', status: 'fail' }),
    ]),
  );
});

test('unknown options fail rather than silently skipping a requested check', () => {
  const { directory } = fixture();
  const result = preflight(directory, {}, ['--runtim']);
  expect(result.status).toBe(1);
  expect(resultChecks(result.stdout)).toContainEqual(
    expect.objectContaining({ name: 'arguments', status: 'fail' }),
  );
});
