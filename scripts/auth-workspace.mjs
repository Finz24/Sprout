import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';

const secret = () => randomBytes(36).toString('base64url');
const host = '127.0.0.1';
const dbPort = process.env.SPROUT_DB_PORT ?? '54329';
const apiPort = process.env.SPROUT_API_PORT ?? '3001';
const workerPort = process.env.SPROUT_WORKER_PORT ?? '3002';
const webPort = process.env.SPROUT_WEB_PORT ?? '5173';
const composeProject = process.env.COMPOSE_PROJECT_NAME ?? 'sprout-issue3-auth';
const composeMode =
  process.env.SPROUT_COMPOSE === '1' || process.argv.includes('--compose');
const dbName = `sprout_auth_${randomBytes(6).toString('hex')}`;
const adminPassword = process.env.POSTGRES_PASSWORD;
const testOwner = {
  name: process.env.SPROUT_OWNER_NAME ?? 'Sprout Owner',
  email: process.env.SPROUT_TEST_EMAIL ?? 'owner@example.invalid',
  password: process.env.SPROUT_TEST_PASSWORD ?? secret(),
};
const children = [];
let composeStarted = false;
let apiChild;
let ownerProvisioned = false;

const volume = `${composeProject}_postgres-data`;
const volumeCheck = spawn('docker', ['volume', 'inspect', volume], {
  stdio: 'ignore',
  windowsHide: true,
});
const volumeExists = await once(volumeCheck, 'exit')
  .then(([code]) => code === 0)
  .catch(() => false);
if (volumeExists && !adminPassword) {
  throw new Error(
    'Set POSTGRES_PASSWORD for the existing workspace volume, or use a new COMPOSE_PROJECT_NAME and unused ports.',
  );
}
const postgresPassword = adminPassword ?? secret();
const rolePasswords = Object.fromEntries(
  ['auth', 'api', 'worker', 'maintenance'].map((name) => [name, secret()]),
);
const encode = encodeURIComponent;
const databaseUrl = (user, password, hostname, port, database) =>
  `postgresql://${user}:${encode(password)}@${hostname}:${port}/${database}`;
const hostUrls = {
  auth: databaseUrl('sprout_auth', rolePasswords.auth, host, dbPort, dbName),
  api: databaseUrl('sprout_api', rolePasswords.api, host, dbPort, dbName),
  worker: databaseUrl(
    'sprout_worker',
    rolePasswords.worker,
    host,
    dbPort,
    dbName,
  ),
  maintenance: databaseUrl(
    'sprout_maintenance',
    rolePasswords.maintenance,
    host,
    dbPort,
    dbName,
  ),
};
const serviceUrls = {
  auth: databaseUrl(
    'sprout_auth',
    rolePasswords.auth,
    'postgres',
    '5432',
    dbName,
  ),
  api: databaseUrl('sprout_api', rolePasswords.api, 'postgres', '5432', dbName),
  worker: databaseUrl(
    'sprout_worker',
    rolePasswords.worker,
    'postgres',
    '5432',
    dbName,
  ),
  maintenance: databaseUrl(
    'sprout_maintenance',
    rolePasswords.maintenance,
    'postgres',
    '5432',
    dbName,
  ),
};
const adminUrl = databaseUrl('sprout', postgresPassword, host, dbPort, dbName);
const migrationServiceUrl = databaseUrl(
  'sprout',
  postgresPassword,
  'postgres',
  '5432',
  dbName,
);
const betterAuthSecret = process.env.BETTER_AUTH_SECRET ?? secret();
const origin = `http://${host}:${webPort}`;
const env = {
  ...process.env,
  COMPOSE_PROJECT_NAME: composeProject,
  NX_DAEMON: 'false',
  NX_NO_CLOUD: 'true',
  POSTGRES_PASSWORD: postgresPassword,
  DATABASE_URL: adminUrl,
  MAINTENANCE_DATABASE_URL: hostUrls.maintenance,
  AUTH_DATABASE_URL: hostUrls.auth,
  API_DATABASE_URL: hostUrls.api,
  WORKER_DATABASE_URL: hostUrls.worker,
  MIGRATION_DATABASE_URL: adminUrl,
  BETTER_AUTH_SECRET: betterAuthSecret,
  SPROUT_ORIGIN: origin,
  SPROUT_LOOPBACK_DEVELOPMENT: 'true',
  SPROUT_OWNER_NAME: testOwner.name,
  SPROUT_OWNER_EMAIL: testOwner.email,
  SPROUT_OWNER_PASSWORD: testOwner.password,
  SPROUT_TEST_EMAIL: testOwner.email,
  SPROUT_TEST_PASSWORD: testOwner.password,
  API_URL: `http://${host}:${apiPort}`,
  WORKER_URL: `http://${host}:${workerPort}`,
  WEB_URL: origin,
};
const composeEnv = {
  ...env,
  DATABASE_URL: migrationServiceUrl,
  MIGRATION_DATABASE_URL: migrationServiceUrl,
  AUTH_DATABASE_URL: serviceUrls.auth,
  API_DATABASE_URL: serviceUrls.api,
  WORKER_DATABASE_URL: serviceUrls.worker,
  MAINTENANCE_DATABASE_URL: serviceUrls.maintenance,
};
const serving = Object.fromEntries(
  Object.entries(env).filter(
    ([name]) =>
      !/DATABASE_URL|PASSWORD|SECRET|OWNER_|TEST_|MIGRATION/.test(name),
  ),
);
function start(command, args, childEnv = env, output = 'pipe') {
  const child = spawn(command, args, {
    env: childEnv,
    stdio: ['ignore', output, output],
    windowsHide: true,
  });
  if (output === 'pipe') {
    const sensitive = Object.entries(env)
      .filter(([name]) => /PASSWORD|SECRET|DATABASE_URL/.test(name))
      .map(([, value]) => value);
    for (const stream of [child.stdout, child.stderr]) {
      const lines = createInterface({ input: stream });
      lines.on('line', (line) => {
        let safe = line.replace(
          /postgres(?:ql)?:\/\/[^\s'"`]+/gi,
          '[database URL redacted]',
        );
        for (const value of sensitive)
          if (value) safe = safe.replaceAll(value, '[redacted]');
        console.error(safe);
      });
    }
  }
  child.on('error', () => {
    console.error('A required process could not start.');
  });
  return child;
}
async function run(command, args, childEnv = env) {
  const child = start(command, args, childEnv);
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error('A workspace command failed.');
}
async function pnpmCommand(args, childEnv = env) {
  if (process.platform === 'win32')
    await run(
      'cmd.exe',
      ['/d', '/s', '/c', `corepack pnpm ${args.join(' ')}`],
      childEnv,
    );
  else await run('corepack', ['pnpm', ...args], childEnv);
}
async function ready(url) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {
      /* Startup is bounded by the deadline. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('A workspace service did not become ready.');
}
async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await once(killer, 'exit').catch(() => undefined);
  } else child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit').catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}
async function stop() {
  if (composeStarted) {
    await run(
      'docker',
      ['compose', 'stop', 'api', 'worker', 'web'],
      composeEnv,
    ).catch(() => undefined);
    composeStarted = false;
  }
  await Promise.allSettled(children.map((child) => stopChild(child)));
}
function launchApi() {
  apiChild = start(
    process.execPath,
    ['--import', 'tsx', '--conditions=development', 'apps/api/src/main.ts'],
    {
      ...serving,
      DATABASE_URL: hostUrls.api,
      AUTH_DATABASE_URL: hostUrls.auth,
      BETTER_AUTH_SECRET: betterAuthSecret,
      DATABASE_POOL_SIZE: '1',
      PORT: apiPort,
      HOST: host,
    },
    'pipe',
  );
  children.push(apiChild);
}
function launchWorker() {
  children.push(
    start(
      process.execPath,
      [
        '--import',
        'tsx',
        '--conditions=development',
        'apps/worker/src/main.ts',
      ],
      {
        ...serving,
        DATABASE_URL: hostUrls.worker,
        PORT: workerPort,
        HOST: host,
      },
      'pipe',
    ),
  );
}
function launchWeb() {
  children.push(
    start(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        '--config',
        'apps/web/vite.config.ts',
        'apps/web',
        '--host',
        host,
        '--port',
        webPort,
      ],
      { ...serving, API_PROXY_URL: env.API_URL },
      'ignore',
    ),
  );
}
async function createDatabase() {
  await run(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      `PGPASSWORD="$POSTGRES_PASSWORD" psql -U sprout -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE "${dbName}"'`,
    ],
    composeEnv,
  );
}
async function migrate() {
  if (composeMode)
    await run('docker', ['compose', 'run', '--rm', 'migrate'], composeEnv);
  else {
    await pnpmCommand(['migrate']);
    await pnpmCommand(['auth:configure-logins']);
  }
}
async function startServices() {
  if (composeMode) {
    await run(
      'docker',
      ['compose', 'up', '-d', '--wait', 'api', 'worker', 'web'],
      composeEnv,
    );
    composeStarted = true;
  } else {
    launchApi();
    launchWorker();
    launchWeb();
  }
  await Promise.all([
    ready(`${env.API_URL}/health/ready`),
    ready(`${env.WORKER_URL}/health/ready`),
    ready(env.WEB_URL),
  ]);
}
async function restartApi() {
  if (composeMode)
    await run('docker', ['compose', 'restart', 'api'], composeEnv);
  else {
    await stopChild(apiChild);
    launchApi();
    await ready(`${env.API_URL}/health/ready`);
  }
}
async function ensureOwner() {
  if (ownerProvisioned) return;
  await pnpmCommand(['auth:bootstrap']);
  ownerProvisioned = true;
}
async function action(command) {
  if (command === 'integration') {
    await pnpmCommand(['test:integration']);
    ownerProvisioned = true;
    await restartApi();
  } else if (command === 'restart') {
    await restartApi();
  } else if (command === 'e2e') {
    await ensureOwner();
    await pnpmCommand(['test:e2e']);
  } else if (command === 'check') await pnpmCommand(['check']);
  else if (command === 'stop') {
    await stop();
    return false;
  } else if (command !== 'status')
    throw new Error('Use integration, e2e, check, restart, status or stop.');
  console.info(`Workspace ${command} finished.`);
  return true;
}
try {
  await pnpmCommand(['check:runtime']);
  await run(
    'docker',
    ['compose', 'up', '-d', '--wait', 'postgres'],
    composeEnv,
  );
  await createDatabase();
  if (composeMode)
    await run(
      'docker',
      ['compose', 'build', 'migrate', 'api', 'worker', 'web'],
      composeEnv,
    );
  await migrate();
  await startServices();
  console.info(
    'Isolated authenticated workspace is ready. Credentials remain only in process environments.',
  );
  if (process.argv.includes('--interactive')) {
    const lines = createInterface({ input: process.stdin, terminal: false });
    for await (const line of lines) {
      try {
        if (!(await action(line.trim()))) break;
      } catch {
        console.error(
          'Workspace action failed. Inspect the sanitized check output.',
        );
      }
    }
  } else {
    if (!process.argv.includes('--e2e-only')) await action('integration');
    if (!process.argv.includes('--integration-only')) await action('e2e');
    await stop();
  }
} catch {
  console.error(
    'Auth workspace setup or verification failed. Existing data and volumes were retained. Supply the existing private credential environment when resuming a volume.',
  );
  await stop();
  process.exitCode = 1;
}
