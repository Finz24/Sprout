import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const FORMAT_VERSION = 1;
const MANIFEST_FILE = 'manifest.json';
const DUMP_FILE = 'database.dump';
const ORIGINALS_DIR = 'originals';
const READ_SIZE = 64 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ROOT_ENTRIES = [MANIFEST_FILE, DUMP_FILE, ORIGINALS_DIR];

class VerificationError extends Error {
  constructor(reason, path) {
    super(reason);
    this.reason = reason;
    this.path = path;
  }
}

function fail(reason, path) {
  throw new VerificationError(reason, path);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isName(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSize(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isHash(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function parseManifest(value) {
  if (!isRecord(value)) {
    fail('invalid-manifest', MANIFEST_FILE);
  }
  if (value.formatVersion !== FORMAT_VERSION) {
    if (typeof value.formatVersion === 'number') {
      fail('unsupported-format-version', MANIFEST_FILE);
    }
    fail('invalid-manifest', MANIFEST_FILE);
  }
  if (
    typeof value.createdAt !== 'string' ||
    !ISO_TIMESTAMP.test(value.createdAt) ||
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    fail('invalid-manifest', MANIFEST_FILE);
  }

  const source = value.source;
  if (
    !isRecord(source) ||
    !isName(source.project) ||
    !isName(source.database) ||
    !Array.isArray(source.runningServices) ||
    !source.runningServices.every(
      (service) => service === 'api' || service === 'worker',
    )
  ) {
    fail('invalid-manifest', MANIFEST_FILE);
  }

  const dump = value.dump;
  if (!isRecord(dump) || !isSize(dump.size) || !isHash(dump.sha256)) {
    fail('invalid-manifest', MANIFEST_FILE);
  }

  if (
    !Array.isArray(value.originals) ||
    !value.originals.every(
      (original) =>
        isRecord(original) &&
        isName(original.path) &&
        isSize(original.size) &&
        isHash(original.sha256),
    ) ||
    !Array.isArray(value.directories) ||
    !value.directories.every((directory) => isName(directory))
  ) {
    fail('invalid-manifest', MANIFEST_FILE);
  }

  if (
    !Array.isArray(value.migrations) ||
    !value.migrations.every(
      (migration) =>
        isRecord(migration) &&
        isName(migration.tag) &&
        typeof migration.when === 'number' &&
        Number.isFinite(migration.when) &&
        isHash(migration.sha256),
    )
  ) {
    fail('invalid-manifest', MANIFEST_FILE);
  }

  const inventory = value.inventory;
  if (
    !isRecord(inventory) ||
    !Array.isArray(inventory.objects) ||
    !inventory.objects.every(
      (object) =>
        isRecord(object) &&
        isName(object.name) &&
        typeof object.definition === 'string',
    ) ||
    !Array.isArray(inventory.tables) ||
    !inventory.tables.every(
      (table) =>
        isRecord(table) &&
        isName(table.schema) &&
        isName(table.name) &&
        typeof table.rows === 'string' &&
        isHash(table.sha256),
    ) ||
    !Array.isArray(inventory.sequences) ||
    !inventory.sequences.every(
      (sequence) =>
        isRecord(sequence) &&
        isName(sequence.schema) &&
        isName(sequence.name) &&
        typeof sequence.lastValue === 'string' &&
        typeof sequence.isCalled === 'boolean',
    )
  ) {
    fail('invalid-manifest', MANIFEST_FILE);
  }

  return value;
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.codePointAt(0);
    return code !== undefined && (code < 0x20 || code === 0x7f);
  });
}

function portablePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    hasControlCharacter(value) ||
    value.includes('\\') ||
    value.includes(':') ||
    value.startsWith('/')
  ) {
    fail('invalid-path', value);
  }
  const segments = value.split('/');
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    fail('invalid-path', value);
  }
  return value;
}

function claimPath(claimed, path) {
  const key = path.toLowerCase();
  if (claimed.has(key)) {
    fail('duplicate-path', path);
  }
  claimed.set(key, true);
}

function validatePaths(manifest) {
  const claimed = new Map();
  const directories = new Set(manifest.directories);
  for (const directory of manifest.directories) {
    claimPath(claimed, portablePath(directory));
  }
  for (const original of manifest.originals) {
    claimPath(claimed, portablePath(original.path));
  }

  const parents = [
    ...manifest.directories,
    ...manifest.originals.map((original) => original.path),
  ];
  for (const path of parents) {
    let parent = posix.dirname(path);
    while (parent !== '.') {
      if (!directories.has(parent)) {
        fail('missing-directory', `${ORIGINALS_DIR}/${parent}`);
      }
      parent = posix.dirname(parent);
    }
  }
}

async function lstatPath(path, display) {
  try {
    return await lstat(path);
  } catch {
    fail('missing-path', display);
  }
}

async function inspectRoot(root) {
  const rootStats = await lstatPath(root, MANIFEST_FILE);
  if (!rootStats.isDirectory()) {
    fail('unsupported-entry', MANIFEST_FILE);
  }

  const entries = await readdir(root);
  const names = new Set(entries);
  for (const name of names) {
    if (!ROOT_ENTRIES.includes(name)) {
      fail('unexpected-entry', name);
    }
  }
  for (const name of ROOT_ENTRIES) {
    if (!names.has(name)) {
      fail('missing-path', name);
    }
  }

  const manifestStats = await lstatPath(
    join(root, MANIFEST_FILE),
    MANIFEST_FILE,
  );
  if (!manifestStats.isFile()) {
    fail('unsupported-entry', MANIFEST_FILE);
  }
  const dumpStats = await lstatPath(join(root, DUMP_FILE), DUMP_FILE);
  if (!dumpStats.isFile()) {
    fail('unsupported-entry', DUMP_FILE);
  }
  const originalsStats = await lstatPath(
    join(root, ORIGINALS_DIR),
    ORIGINALS_DIR,
  );
  if (originalsStats.isSymbolicLink()) {
    fail('symbolic-link', ORIGINALS_DIR);
  }
  if (!originalsStats.isDirectory()) {
    fail('unsupported-entry', ORIGINALS_DIR);
  }
}

async function readManifest(root) {
  let source;
  try {
    source = await readFile(join(root, MANIFEST_FILE), 'utf8');
  } catch {
    fail('missing-path', MANIFEST_FILE);
  }

  let value;
  try {
    value = JSON.parse(source);
  } catch {
    fail('invalid-manifest', MANIFEST_FILE);
  }
  return parseManifest(value);
}

async function walkOriginals(absolute, relative, files, directories) {
  const display = relative ? `${ORIGINALS_DIR}/${relative}` : ORIGINALS_DIR;
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch {
    fail('missing-path', display);
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    const entryDisplay = `${ORIGINALS_DIR}/${path}`;
    portablePath(path);
    const stats = await lstatPath(join(absolute, entry.name), entryDisplay);
    if (stats.isSymbolicLink()) {
      fail('symbolic-link', entryDisplay);
    }
    if (stats.isDirectory()) {
      directories.add(path);
      await walkOriginals(join(absolute, entry.name), path, files, directories);
      continue;
    }
    if (stats.isFile()) {
      files.set(path, stats);
      continue;
    }
    fail('unsupported-entry', entryDisplay);
  }
}

async function scanOriginals(root) {
  const originals = join(root, ORIGINALS_DIR);
  const files = new Map();
  const directories = new Set();
  await walkOriginals(originals, '', files, directories);
  return { files, directories };
}

function compareEntries(manifest, actual) {
  const declaredDirectories = new Set(manifest.directories);
  for (const directory of [...actual.directories].sort()) {
    if (!declaredDirectories.has(directory)) {
      fail('unexpected-directory', `${ORIGINALS_DIR}/${directory}`);
    }
  }
  for (const directory of manifest.directories) {
    if (!actual.directories.has(directory)) {
      fail('missing-directory', `${ORIGINALS_DIR}/${directory}`);
    }
  }

  const declaredFiles = new Set(
    manifest.originals.map((original) => original.path),
  );
  for (const path of [...actual.files.keys()].sort()) {
    if (!declaredFiles.has(path)) {
      fail('unexpected-file', `${ORIGINALS_DIR}/${path}`);
    }
  }
}

async function hashFile(path) {
  const handle = await open(path, 'r');
  const hash = createHash('sha256');
  let size = 0;
  try {
    const buffer = Buffer.allocUnsafe(READ_SIZE);
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      size += bytesRead;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return { size, sha256: hash.digest('hex') };
}

async function verifyFile(path, expected, display) {
  const stats = await lstatPath(path, display);
  if (!stats.isFile()) {
    fail('missing-path', display);
  }
  if (stats.size !== expected.size) {
    fail('size-mismatch', display);
  }
  const digest = await hashFile(path);
  if (digest.size !== expected.size) {
    fail('size-mismatch', display);
  }
  if (digest.sha256 !== expected.sha256) {
    fail('sha256-mismatch', display);
  }
}

export async function verifyBackup(from) {
  await inspectRoot(from);
  const manifest = await readManifest(from);
  validatePaths(manifest);
  const actual = await scanOriginals(from);
  compareEntries(manifest, actual);

  await verifyFile(join(from, DUMP_FILE), manifest.dump, DUMP_FILE);
  for (const original of manifest.originals) {
    const path = join(from, ORIGINALS_DIR, ...original.path.split('/'));
    await verifyFile(path, original, `${ORIGINALS_DIR}/${original.path}`);
  }

  return manifest;
}

const REPO = resolve(import.meta.dirname, '..');
const SESSION = [
  'client_encoding=UTF8',
  'TimeZone=UTC',
  'DateStyle=ISO,YMD',
  'IntervalStyle=postgres',
  'extra_float_digits=3',
  'bytea_output=hex',
  'row_security=off',
  'standard_conforming_strings=on',
  'search_path=pg_catalog',
]
  .map((setting) => `-c ${setting}`)
  .join(' ');

function identifier(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

function literal(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

// Child diagnostics can contain credentials, SQL bodies or private rows.
async function docker(
  args,
  { env, input, inputFile, outputFile, consume, signal } = {},
) {
  const child = spawn('docker', args, {
    cwd: REPO,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120_000,
    signal,
  });
  child.stderr.resume();
  const output = [];
  let outputSize = 0;
  const transfers = [];
  if (outputFile) {
    transfers.push(
      pipeline(
        child.stdout,
        createWriteStream(outputFile, { flags: 'wx', mode: 0o600 }),
      ),
    );
  } else {
    child.stdout.on('data', (bytes) => {
      if (consume) consume(bytes);
      else {
        output.push(bytes);
        outputSize += bytes.length;
        if (outputSize > 64 * 1024 * 1024) child.kill();
      }
    });
  }
  if (inputFile)
    transfers.push(pipeline(createReadStream(inputFile), child.stdin));
  else child.stdin.end(input);
  const completion = new Promise((resolveResult, reject) => {
    child.once('error', () =>
      reject(new VerificationError('command-failed', args[0])),
    );
    child.stdin.on('error', () => {});
    child.once('close', (code) =>
      code === 0
        ? resolveResult()
        : reject(new VerificationError('command-failed', args[0])),
    );
  });
  try {
    await Promise.all([completion, ...transfers]);
  } catch (error) {
    child.kill();
    if (error instanceof VerificationError) throw error;
    fail('command-failed', args[0]);
  }
  return Buffer.concat(output).toString('utf8').trimEnd();
}

async function workspace() {
  const config = JSON.parse(
    await docker(['compose', 'config', '--format', 'json']),
  );
  const project = config.name;
  if (!project || !/^[a-z0-9][a-z0-9_-]*$/.test(project))
    fail('compose-project-required');
  const compose = (...args) => docker(['compose', '-p', project, ...args]);
  const dbIds = (await compose('ps', '--all', '--quiet', 'postgres'))
    .split(/\s+/)
    .filter(Boolean);
  if (dbIds.length !== 1) fail('database-container-required');
  const [container] = JSON.parse(await docker(['inspect', dbIds[0]]));
  if (
    !container.State.Running ||
    container.Config.Labels['com.docker.compose.project'] !== project ||
    container.Config.Labels['com.docker.compose.service'] !== 'postgres'
  )
    fail('database-container-required');
  let connection;
  try {
    connection = new URL(
      process.env.SPROUT_BACKUP_DATABASE_URL ??
        config.services.api.environment.DATABASE_URL,
    );
    if (
      !['postgres:', 'postgresql:'].includes(connection.protocol) ||
      connection.search ||
      connection.hash
    )
      throw new Error();
    const port = connection.port || '5432';
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(
      connection.hostname,
    );
    const published = container.NetworkSettings.Ports['5432/tcp'] ?? [];
    const alias =
      connection.hostname === 'postgres' ||
      connection.hostname === container.Name.slice(1);
    if (
      !(alias && port === '5432') &&
      !(local && published.some((binding) => binding.HostPort === port))
    )
      throw new Error();
    connection = {
      PGHOST: '127.0.0.1',
      PGPORT: '5432',
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
      PGCLIENTENCODING: 'UTF8',
      PGOPTIONS: SESSION,
      PGCONNECT_TIMEOUT: '10',
    };
    if (
      !connection.PGUSER ||
      !connection.PGDATABASE ||
      Object.values(connection).some((v) => v.includes('\0'))
    )
      throw new Error();
  } catch {
    fail('invalid-database-endpoint');
  }
  const appIds = (await compose('ps', '--all', '--quiet', 'api', 'worker'))
    .split(/\s+/)
    .filter(Boolean);
  if (!appIds.length) fail('originals-mount-required');
  const apps = JSON.parse(await docker(['inspect', ...appIds]));
  const mounts = apps.map((app) =>
    app.Mounts.find((mount) => mount.Destination === '/workspace/originals'),
  );
  if (
    mounts.some(
      (mount) => !mount || !['volume', 'bind'].includes(mount.Type),
    ) ||
    mounts.some((mount) => mount.Source !== mounts[0].Source)
  )
    fail('originals-mount-required');
  const running = apps
    .filter((app) => app.State.Running)
    .map((app) => ({
      id: app.Id,
      service: app.Config.Labels['com.docker.compose.service'],
    }));
  const pg = (database, program, args = [], options = {}) => {
    const env = { ...connection, PGDATABASE: database };
    return docker(
      [
        'exec',
        '-i',
        ...Object.keys(env).flatMap((key) => ['--env', key]),
        container.Id,
        program,
        ...args,
      ],
      { ...options, env },
    );
  };
  const sql = (database, input, options) =>
    pg(database, 'psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {
      ...options,
      input,
    });
  return {
    project,
    database: connection.PGDATABASE,
    mount: mounts[0],
    liveOriginals: [
      mounts[0].Source,
      ...['api', 'worker'].flatMap((service) =>
        config.services[service].volumes
          .filter(
            (mount) =>
              mount.target === '/workspace/originals' && mount.type === 'bind',
          )
          .map((mount) => mount.source),
      ),
    ],
    appIds,
    running,
    image: container.Image,
    pg,
    sql,
  };
}

async function committedMigrations() {
  const root = join(REPO, 'packages/database/migrations');
  const journal = JSON.parse(
    await readFile(join(root, 'meta/_journal.json'), 'utf8'),
  );
  return Promise.all(
    journal.entries.map(async ({ tag, when }) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(tag) || !Number.isSafeInteger(when))
        fail('invalid-repo-migrations');
      return {
        tag,
        when,
        sha256: (await hashFile(join(root, `${tag}.sql`))).sha256,
      };
    }),
  );
}

async function checkHistory(ws, database, migrations) {
  const rows = JSON.parse(
    await ws.sql(
      database,
      "SELECT coalesce(json_agg(json_build_array(hash, created_at::text) ORDER BY created_at, id), '[]'::json) FROM drizzle.__drizzle_migrations;",
    ),
  );
  const expected = migrations.map(({ sha256, when }) => [sha256, String(when)]);
  if (JSON.stringify(rows) !== JSON.stringify(expected))
    fail('migration-history-mismatch', 'drizzle.__drizzle_migrations');
}

function normalizeSchema(schema) {
  // Strip only pg_dump's generated envelope. SQL bodies and object comments are exact.
  return `${schema}\n`
    .replace(
      /^(--\n-- PostgreSQL database dump\n--\n\n)\\restrict [a-zA-Z0-9]+\n\n/,
      '$1',
    )
    .replace(
      /^(--\n-- PostgreSQL database dump\n--\n\n)-- Dumped from database version [^\n]+\n-- Dumped by pg_dump version [^\n]+\n/,
      '$1',
    )
    .replace(
      /(\n--\n-- PostgreSQL database dump complete\n--\n\n)\\unrestrict [a-zA-Z0-9]+\n+$/,
      '$1',
    );
}

async function inventory(ws, database, signal) {
  const unsupported = await ws.sql(
    database,
    `SELECT
    (SELECT count(*) FROM pg_foreign_table) + (SELECT count(*) FROM pg_foreign_server) +
    (SELECT count(*) FROM pg_subscription) + (SELECT count(*) FROM pg_largeobject_metadata) +
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_tablespace t ON t.oid = c.reltablespace
      WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND t.spcname <> 'pg_default') +
    (SELECT count(*) FROM pg_database d JOIN pg_tablespace t ON t.oid = d.dattablespace
      WHERE d.datname = current_database() AND t.spcname <> 'pg_default');`,
    { signal },
  );
  if (unsupported !== '0') fail('unsupported-external-data', 'database');
  const schema = normalizeSchema(
    await ws.pg(database, 'pg_dump', ['--schema-only'], { signal }),
  );
  const relations = JSON.parse(
    await ws.sql(
      database,
      `SELECT coalesce(json_agg(
    json_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
      'columns', (SELECT coalesce(json_agg(a.attname ORDER BY a.attnum), '[]'::json)
        FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped))
    ORDER BY n.nspname COLLATE "C", c.relname COLLATE "C"), '[]'::json)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r','m','S') AND n.nspname <> 'information_schema'
      AND n.nspname !~ '^pg_';`,
      { signal },
    ),
  );
  const tables = [];
  const sequences = [];
  for (const relation of relations) {
    const { schema, name, kind, columns } = relation;
    const qualified = `${identifier(schema)}.${identifier(name)}`;
    if (kind === 'S') {
      const state = JSON.parse(
        await ws.sql(
          database,
          `SELECT json_build_object('lastValue', last_value::text, 'isCalled', is_called) FROM ${qualified};`,
          { signal },
        ),
      );
      sequences.push({ schema, name, ...state });
    } else {
      const hash = createHash('sha256');
      let rows = 0n;
      await ws.sql(
        database,
        `COPY (SELECT row FROM (SELECT json_build_array(${columns.map((column) => `${identifier(column)}::text`).join(',')})::text AS row
        FROM ONLY ${qualified}) inventory_rows ORDER BY row COLLATE "C") TO STDOUT;`,
        {
          signal,
          consume: (bytes) => {
            hash.update(bytes);
            for (const byte of bytes) if (byte === 10) rows += 1n;
          },
        },
      );
      tables.push({
        schema,
        name,
        rows: String(rows),
        sha256: hash.digest('hex'),
      });
    }
  }
  return {
    objects: [{ name: 'database-schema', definition: schema }],
    tables,
    sequences,
  };
}

function compareInventory(expected, actual) {
  for (const section of ['objects', 'tables', 'sequences']) {
    const key = (entry) => JSON.stringify([entry.schema, entry.name]);
    const entries = new Map(
      actual[section].map((entry) => [key(entry), entry]),
    );
    for (const entry of expected[section]) {
      if (JSON.stringify(entry) !== JSON.stringify(entries.get(key(entry)))) {
        fail(
          'incomplete-restore',
          entry.schema ? `${entry.schema}.${entry.name}` : entry.name,
        );
      }
      entries.delete(key(entry));
    }
    if (entries.size)
      fail('unexpected-database-object', entries.values().next().value.name);
  }
}

async function noLinks(path) {
  let current = resolve(path);
  while (true) {
    try {
      if ((await lstat(current)).isSymbolicLink())
        fail('symbolic-link', current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function overlaps(left, right) {
  const inside = (a, b) => {
    const path = relative(resolve(a), resolve(b));
    return (
      path === '' ||
      (!path.startsWith(`..${sep}`) &&
        path !== '..' &&
        !path.startsWith(sep) &&
        !/^[A-Za-z]:/.test(path))
    );
  };
  return inside(left, right) || inside(right, left);
}

async function absent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  fail('target-exists', path);
}

async function originalsInventory(directory) {
  const files = new Map();
  const directories = new Set();
  await walkOriginals(directory, '', files, directories);
  const originals = [];
  for (const path of [...files.keys()].sort()) {
    originals.push({
      path,
      ...(await hashFile(join(directory, ...path.split('/')))),
    });
  }
  const result = { originals, directories: [...directories].sort() };
  validatePaths(result);
  return result;
}

async function copyOriginals(source, target, manifest) {
  for (const path of manifest.directories) {
    await mkdir(join(target, ...path.split('/')), { mode: 0o700 });
  }
  for (const file of manifest.originals) {
    await noLinks(join(target, ...file.path.split('/')));
    await copyFile(
      join(source, ...file.path.split('/')),
      join(target, ...file.path.split('/')),
      constants.COPYFILE_EXCL,
    );
  }
}

async function verifyOriginals(target, manifest) {
  const actual = { files: new Map(), directories: new Set() };
  await noLinks(target);
  await walkOriginals(target, '', actual.files, actual.directories);
  compareEntries(manifest, actual);
  for (const file of manifest.originals) {
    await verifyFile(
      join(target, ...file.path.split('/')),
      file,
      `${ORIGINALS_DIR}/${file.path}`,
    );
  }
}

async function backupTo(dest) {
  dest = resolve(dest);
  await noLinks(dest);
  await absent(dest);
  const ws = await workspace();
  const source = process.env.SPROUT_BACKUP_ORIGINALS_DIR;
  for (const path of [source, ...ws.liveOriginals].filter(Boolean)) {
    if (overlaps(dest, path)) fail('overlapping-originals', dest);
  }
  if (source) await noLinks(source);
  const migrations = await committedMigrations();
  // The Docker name is a daemon-wide exclusive lease, also across host processes.
  // After an uncatchable crash, inspect/restart recorded app IDs and remove the
  // stopped lease container manually. Exclude all external writers throughout.
  const lock = (
    await docker([
      'create',
      '--pull',
      'never',
      '--name',
      `${ws.project}-backup-lock`,
      '--network',
      'none',
      '--label',
      `sprout.backup.running=${ws.running.map((app) => app.id).join(',')}`,
      ...(!source
        ? [
            '--mount',
            ws.mount.Type === 'volume'
              ? `type=volume,source=${ws.mount.Name},target=/originals,readonly,volume-nocopy`
              : `type=bind,source=${ws.mount.Source},target=/originals,readonly`,
          ]
        : []),
      ws.image,
      'true',
    ])
  ).trim();
  const controller = new globalThis.AbortController();
  const interrupted = () => controller.abort();
  process.once('SIGINT', interrupted);
  process.once('SIGTERM', interrupted);
  let restartFailed = false;
  let stopped = [];
  let partial;
  try {
    const current = JSON.parse(await docker(['inspect', ...ws.appIds]));
    const runningIds = current
      .filter((app) => app.State.Running)
      .map((app) => app.Id)
      .sort();
    if (
      JSON.stringify(runningIds) !==
      JSON.stringify(ws.running.map((app) => app.id).sort())
    ) {
      fail('service-state-changed');
    }
    partial = await mkdtemp(
      join(
        dirname(dest),
        `.${posix.basename(dest.replaceAll('\\', '/'))}.partial-`,
      ),
    );
    stopped = ws.running;
    for (const app of stopped) await docker(['stop', '--time', '20', app.id]);
    if (controller.signal.aborted) fail('interrupted');
    await checkHistory(ws, ws.database, migrations);
    const before = await inventory(ws, ws.database, controller.signal);
    await ws.pg(ws.database, 'pg_dump', ['--format=custom'], {
      outputFile: join(partial, DUMP_FILE),
      signal: controller.signal,
    });
    const originals = join(partial, ORIGINALS_DIR);
    await mkdir(originals, { mode: 0o700 });
    if (source) {
      const listing = await originalsInventory(source);
      await copyOriginals(source, originals, listing);
      await verifyOriginals(source, listing);
      await verifyOriginals(originals, listing);
    } else {
      await docker(['cp', `${lock}:/originals/.`, originals], {
        signal: controller.signal,
      });
    }
    const manifest = {
      formatVersion: FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      source: {
        project: ws.project,
        database: ws.database,
        runningServices: ws.running.map((app) => app.service),
      },
      dump: await hashFile(join(partial, DUMP_FILE)),
      ...(await originalsInventory(originals)),
      migrations,
      inventory: before,
    };
    compareInventory(
      before,
      await inventory(ws, ws.database, controller.signal),
    );
    await checkHistory(ws, ws.database, migrations);
    await writeFile(
      join(partial, MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    await verifyBackup(partial);
    if (controller.signal.aborted) fail('interrupted');
    await absent(dest);
    await rename(partial, dest);
    return { status: 'backed-up', files: manifest.originals.length + 1 };
  } finally {
    for (const app of stopped) {
      try {
        await docker(['start', app.id]);
      } catch {
        restartFailed = true;
      }
    }
    try {
      if (!restartFailed) await docker(['rm', lock]);
    } finally {
      process.removeListener('SIGINT', interrupted);
      process.removeListener('SIGTERM', interrupted);
    }
    if (restartFailed)
      fail(
        'service-restart-failed',
        ws.running.map((app) => app.service).join(','),
      );
  }
}

export async function backupWorkspace(args) {
  try {
    if (
      args.length !== 2 ||
      args[0] !== '--dest' ||
      !args[1] ||
      args[1].startsWith('--')
    )
      fail('invalid-arguments');
    writeResult(await backupTo(args[1]));
  } catch (error) {
    writeResult(describeFailure(error));
    process.exitCode = 1;
  }
}

async function restoreWorkspace(from, database, originals, manifest) {
  const migrations = await committedMigrations();
  if (JSON.stringify(manifest.migrations) !== JSON.stringify(migrations))
    fail('repo-migrations-mismatch', 'migrations');
  const ws = await workspace();
  if (
    !/^[a-z][a-z0-9_]*$/.test(database) ||
    Buffer.byteLength(database) > 63 ||
    [
      'sprout',
      'postgres',
      'template0',
      'template1',
      ws.database,
      manifest.source.database,
    ].includes(database)
  ) {
    fail('unsafe-database-target', database);
  }
  const requestedOriginals = originals;
  originals = resolve(originals);
  const forbidden = [
    from,
    join(REPO, 'originals'),
    '/workspace/originals',
    process.env.SPROUT_BACKUP_ORIGINALS_DIR,
    ...ws.liveOriginals,
  ].filter(Boolean);
  await noLinks(originals);
  if (requestedOriginals === ws.mount.Name)
    fail('unsafe-originals-target', requestedOriginals);
  for (const path of forbidden)
    if (overlaps(originals, path))
      fail('unsafe-originals-target', requestedOriginals);
  try {
    if (
      !(await lstat(originals)).isDirectory() ||
      (await readdir(originals)).length
    )
      fail('nonempty-originals-target', originals);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (
    (await ws.sql(
      'postgres',
      `SELECT count(*) FROM pg_database WHERE datname = ${literal(database)};`,
    )) !== '0'
  )
    fail('database-exists', database);
  // Read-only checks above precede either target mutation. Never clean/drop a target.
  await ws.pg('postgres', 'createdb', ['--template=template0', '--', database]);
  await ws.pg(
    database,
    'pg_restore',
    ['--exit-on-error', '--single-transaction', '--dbname', database],
    { inputFile: join(from, DUMP_FILE) },
  );
  await noLinks(originals);
  await mkdir(originals, { recursive: true, mode: 0o700 });
  if ((await readdir(originals)).length)
    fail('nonempty-originals-target', originals);
  await copyOriginals(join(from, ORIGINALS_DIR), originals, manifest);
  await verifyOriginals(originals, manifest);
  await checkHistory(ws, database, migrations);
  compareInventory(manifest.inventory, await inventory(ws, database));
  return { status: 'restored', files: manifest.originals.length + 1 };
}

function parseArguments(args) {
  let from;
  let verifyOnly = false;
  let database;
  let originals;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--verify-only' && !verifyOnly) {
      verifyOnly = true;
      continue;
    }
    if (
      (argument === '--from' && from === undefined) ||
      (argument === '--database' && database === undefined) ||
      (argument === '--originals' && originals === undefined)
    ) {
      const value = args[index + 1];
      if (value === undefined || value.length === 0 || value.startsWith('--')) {
        fail('invalid-arguments');
      }
      if (argument === '--from') from = value;
      if (argument === '--database') database = value;
      if (argument === '--originals') originals = value;
      index += 1;
      continue;
    }
    fail('invalid-arguments');
  }
  if (
    from === undefined ||
    (verifyOnly
      ? database !== undefined || originals !== undefined
      : database === undefined || originals === undefined)
  ) {
    fail('invalid-arguments');
  }
  return { from: resolve(from), verifyOnly, database, originals };
}

function describeFailure(error) {
  if (error instanceof VerificationError) {
    return error.path === undefined
      ? { status: 'failed', reason: error.reason }
      : { status: 'failed', reason: error.reason, path: error.path };
  }
  return { status: 'failed', reason: 'internal-error' };
}

function writeResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function main(args) {
  try {
    const { from, verifyOnly, database, originals } = parseArguments(args);
    const manifest = await verifyBackup(from);
    writeResult(
      verifyOnly
        ? { status: 'verified', files: manifest.originals.length + 1 }
        : await restoreWorkspace(from, database, originals, manifest),
    );
  } catch (error) {
    writeResult(describeFailure(error));
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (
  entry !== undefined &&
  pathToFileURL(resolve(entry)).href === import.meta.url
) {
  await main(process.argv.slice(2));
}
