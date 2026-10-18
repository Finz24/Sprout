import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const results = [];
const check = (name, run, success, failure) => {
  let passed = false;
  try {
    passed = run();
  } catch {
    // File contents and subprocess diagnostics can contain credentials.
  }
  results.push({
    name,
    status: passed ? 'pass' : 'fail',
    message: passed ? success : failure,
  });
};
const read = (path) => readFileSync(path, 'utf8').trim();
const manifest = () => JSON.parse(read('package.json'));
const exactVersion = /^\d+\.\d+\.\d+$/;
const packageManagerVersion = () => {
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(manifest().packageManager);
  return match?.[1];
};
const run = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 64 * 1024,
    windowsHide: true,
    env: { ...process.env, COREPACK_ENABLE_NETWORK: '0' },
  });
  return !result.error && result.status === 0;
};

check(
  'arguments',
  () => process.argv.slice(2).every((arg) => arg === '--runtime'),
  'Supported options.',
  'Run from the repository root with no options or --runtime.',
);
check(
  'node-pin',
  () =>
    exactVersion.test(read('.nvmrc')) &&
    read('.nvmrc') === manifest().engines?.node,
  '.nvmrc and package.json declare the same exact Node version.',
  'Set matching exact Node versions in .nvmrc and package.json engines.node.',
);
check(
  'node-runtime',
  () => read('.nvmrc') === process.versions.node,
  'The running Node version matches .nvmrc.',
  'Select the Node version declared in .nvmrc with nvm-windows.',
);
check(
  'package-manager',
  () => Boolean(packageManagerVersion()),
  'packageManager declares an exact pnpm version.',
  'Set package.json packageManager to pnpm with an exact version.',
);
check(
  'package-config',
  () => {
    const config = new Map(
      read('.npmrc')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/^\s*[#;]/.test(line))
        .map((line) => line.split('=').map((part) => part.trim())),
    );
    return ['engine-strict', 'save-exact', 'strict-peer-dependencies'].every(
      (key) => config.get(key) === 'true',
    );
  },
  '.npmrc enforces engines, exact saves and strict peer dependencies.',
  'Enable engine-strict, save-exact and strict-peer-dependencies in .npmrc.',
);
check(
  'docker-pins',
  () => {
    const instructions = read('Dockerfile')
      .replace(/\\\r?\n/g, ' ')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    const node =
      /^FROM node:(\d+\.\d+\.\d+)-[^\s@]+@sha256:[a-f0-9]{64}\s*$/.exec(
        instructions.find((line) => /^FROM\s/i.test(line)) ?? '',
      );
    const installs = instructions.filter(
      (line) =>
        /^RUN\s/i.test(line) &&
        /\b(?:corepack|pnpm)\b/.test(line) &&
        line !== 'RUN corepack pnpm install --frozen-lockfile',
    );
    const install =
      /^RUN\s+npm install --global corepack@\d+\.\d+\.\d+\s+&&\s+corepack prepare pnpm@(\d+\.\d+\.\d+) --activate$/.exec(
        installs[0] ?? '',
      );
    return (
      node?.[1] === read('.nvmrc') &&
      installs.length === 1 &&
      Boolean(install) &&
      install?.[1] === packageManagerVersion()
    );
  },
  'Docker pins match Node and pnpm, with pinned Corepack and base digest.',
  'Pin the Docker Node image, Corepack and pnpm; match repository versions.',
);
check(
  'compose-environment',
  () => {
    const project = process.env.COMPOSE_PROJECT_NAME || 'sprout';
    const ports = [
      process.env.SPROUT_DB_PORT || '54329',
      process.env.SPROUT_API_PORT || '3001',
      process.env.SPROUT_WORKER_PORT || '3002',
      process.env.SPROUT_WEB_PORT || '5173',
    ];
    return (
      /^[a-z0-9][a-z0-9_-]*$/.test(project) &&
      ports.every(
        (port) =>
          /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535,
      ) &&
      new Set(ports.map(Number)).size === ports.length
    );
  },
  'Compose project identity and distinct host ports are valid.',
  'Use a valid Compose project name and four distinct host ports from 1 to 65535.',
);

if (process.argv.includes('--runtime')) {
  check(
    'docker-daemon',
    () => run('docker', ['version', '--format', '{{.Server.Version}}']),
    'Docker daemon is reachable.',
    'Docker daemon is unavailable. Start the prepared Docker Desktop installation.',
  );
  check(
    'docker-compose',
    () =>
      run('docker', ['compose', 'version', '--short']) &&
      run('docker', ['compose', 'config', '--quiet']),
    'Docker Compose is installed and accepts the configuration.',
    'Docker Compose is unavailable or rejects compose.yaml and its environment.',
  );
  check(
    'playwright-browser',
    () =>
      run(process.execPath, [
        '--input-type=module',
        '-e',
        "import { createRequire } from 'node:module'; import { existsSync } from 'node:fs'; import { resolve } from 'node:path'; const require = createRequire(resolve('package.json')); const { chromium } = require('@playwright/test'); process.exit(existsSync(chromium.executablePath()) ? 0 : 1);",
      ]),
    'The installed Playwright package has a Chromium executable.',
    'Prepare local dependencies and the matching Playwright Chromium cache before going offline.',
  );
}

process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
process.exitCode = results.some((result) => result.status === 'fail') ? 1 : 0;
