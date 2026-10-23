import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { lstat, open, readdir, readFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
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

function parseArguments(args) {
  let from;
  let verifyOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--verify-only' && !verifyOnly) {
      verifyOnly = true;
      continue;
    }
    if (argument === '--from' && from === undefined) {
      const value = args[index + 1];
      if (value === undefined || value.length === 0 || value.startsWith('--')) {
        fail('invalid-arguments');
      }
      from = value;
      index += 1;
      continue;
    }
    fail('invalid-arguments');
  }
  if (!verifyOnly || from === undefined) {
    fail('invalid-arguments');
  }
  return { from };
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
    const { from } = parseArguments(args);
    const manifest = await verifyBackup(from);
    writeResult({ status: 'verified', files: manifest.originals.length + 1 });
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
