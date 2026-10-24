import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const script = resolve('scripts/restore-workspace.mjs');
const roots: string[] = [];

const dumpBytes = Buffer.from('PGDMP-sprout-fixture-v1\n');
const noteBytes = Buffer.from('Sprout fixture note.\n');
const coverBytes = Buffer.from([0, 1, 2, 3, 254, 255]);
const dumpSha256 =
  'c29ce161d7c948728481f0cbc9dc5070d2ff2c813b9883769a8e6c5609d3e431';
const noteSha256 =
  'e986c3da4075aadd5c006cea42175cbba2eeb152f7c012f4c8d5fcb107850ddb';
const coverSha256 =
  '7ea646958715ed687aa9ac2f5d785feb1a93411f4f25fdd6c7fcc6ab07fdf0e3';

interface Original {
  path: string;
  size: number;
  sha256: string;
}

interface Manifest {
  formatVersion: number;
  createdAt: string;
  source: {
    project: string;
    database: string;
    runningServices: ('api' | 'worker')[];
  };
  dump: { size: number; sha256: string };
  originals: Original[];
  directories: string[];
  migrations: { tag: string; when: number; sha256: string }[];
  inventory: {
    objects: { name: string; definition: string }[];
    tables: { schema: string; name: string; rows: string; sha256: string }[];
    sequences: {
      schema: string;
      name: string;
      lastValue: string;
      isCalled: boolean;
    }[];
  };
}

interface CliResult {
  status: string;
  reason?: string;
  path?: string;
  files?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCliResult(value: unknown): value is CliResult {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }
  return (
    (value.reason === undefined || typeof value.reason === 'string') &&
    (value.path === undefined || typeof value.path === 'string') &&
    (value.files === undefined || typeof value.files === 'number')
  );
}

function parseCliResult(stdout: string): CliResult {
  const value: unknown = JSON.parse(stdout);
  if (!isCliResult(value)) {
    throw new Error('The verifier must return a named status.');
  }
  return value;
}

function validManifest(): Manifest {
  return {
    formatVersion: 1,
    createdAt: '2026-10-23T09:30:00.000Z',
    source: {
      project: 'sprout-fixture',
      database: 'sprout_fixture',
      runningServices: ['api', 'worker'],
    },
    dump: { size: dumpBytes.length, sha256: dumpSha256 },
    originals: [
      { path: 'notes.txt', size: noteBytes.length, sha256: noteSha256 },
      {
        path: 'photos/cover.bin',
        size: coverBytes.length,
        sha256: coverSha256,
      },
    ],
    directories: ['photos'],
    migrations: [
      {
        tag: '0000_fixture',
        when: 1761200000000,
        sha256:
          '4d2f6f3c1a5e8b7d0c9a2b4e6f8a1c3d5e7b9a0c2d4f6a8b1c3e5d7f9a0b2c4d',
      },
    ],
    inventory: {
      objects: [{ name: 'fixture_table', definition: 'CREATE TABLE fixture' }],
      tables: [
        {
          schema: 'public',
          name: 'fixture_table',
          rows: '2',
          sha256:
            '9c1e3a5f7b2d4c6e8a0f1b3d5c7e9a2f4b6d8c0e1a3f5b7d9c2e4a6f8b0d1c3e',
        },
      ],
      sequences: [
        {
          schema: 'public',
          name: 'fixture_table_id_seq',
          lastValue: '2',
          isCalled: true,
        },
      ],
    },
  };
}

function saveManifest(directory: string, manifest: unknown): void {
  writeFileSync(
    join(directory, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
}

function createBackup() {
  const root = mkdtempSync(join(tmpdir(), 'sprout-backup-'));
  roots.push(root);
  const directory = join(root, 'backup');
  mkdirSync(join(directory, 'originals', 'photos'), { recursive: true });
  writeFileSync(join(directory, 'database.dump'), dumpBytes);
  writeFileSync(join(directory, 'originals', 'notes.txt'), noteBytes);
  writeFileSync(
    join(directory, 'originals', 'photos', 'cover.bin'),
    coverBytes,
  );
  const manifest = validManifest();
  saveManifest(directory, manifest);
  return { root, directory, manifest };
}

function verify(
  directory: string,
  args: string[] = ['--verify-only', '--from', directory],
) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 10000,
    env: {
      ...process.env,
      PATH: '',
      SPROUT_BACKUP_DATABASE_URL: 'redaction-probe',
    },
  });
  expect(result.error).toBeUndefined();
  return result;
}

function failure(stdout: string): CliResult {
  const result = parseCliResult(stdout);
  expect(result.status).toBe('failed');
  return result;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verifies an intact backup without external commands or environment access', () => {
  const { directory } = createBackup();
  const result = verify(directory);
  expect(result.status).toBe(0);
  expect(parseCliResult(result.stdout)).toMatchObject({
    status: 'verified',
    files: 3,
  });
  expect(result.stdout).not.toContain('redaction-probe');
});

test.each([
  {
    name: 'database dump',
    path: 'database.dump',
    tamper: (directory: string) =>
      writeFileSync(
        join(directory, 'database.dump'),
        Buffer.from('PGDMP-sprout-fixture-v2\n'),
      ),
  },
  {
    name: 'original file',
    path: 'originals/notes.txt',
    tamper: (directory: string) =>
      writeFileSync(
        join(directory, 'originals', 'notes.txt'),
        Buffer.from('Sprout fixture note!\n'),
      ),
  },
])('rejects a tampered $name and names $path', ({ path, tamper }) => {
  const { directory } = createBackup();
  tamper(directory);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'sha256-mismatch',
    path,
  });
});

test.each([
  {
    name: 'database dump',
    path: 'database.dump',
    remove: (directory: string) => rmSync(join(directory, 'database.dump')),
  },
  {
    name: 'original file',
    path: 'originals/notes.txt',
    remove: (directory: string) =>
      rmSync(join(directory, 'originals', 'notes.txt')),
  },
])('rejects a missing $name and names $path', ({ path, remove }) => {
  const { directory } = createBackup();
  remove(directory);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'missing-path',
    path,
  });
});

test('rejects an unknown manifest format version', () => {
  const { directory, manifest } = createBackup();
  manifest.formatVersion = 2;
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'unsupported-format-version',
    path: 'manifest.json',
  });
});

test.each([
  '../escape.txt',
  '/absolute.txt',
  'C:/absolute.txt',
  'nested\\file.txt',
  'nested\u0000file.txt',
  'file.txt:stream',
])('rejects the non-portable original path %j', (path) => {
  const { directory, manifest } = createBackup();
  manifest.originals.splice(0, 1, {
    path,
    size: noteBytes.length,
    sha256: noteSha256,
  });
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-path',
    path,
  });
});

test('rejects a symbolic link instead of following it', () => {
  const { root, directory, manifest } = createBackup();
  const outside = join(root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'secret.txt'), noteBytes);
  symlinkSync(outside, join(directory, 'originals', 'linked'), 'junction');
  manifest.directories.push('linked');
  manifest.originals.push({
    path: 'linked/secret.txt',
    size: noteBytes.length,
    sha256: noteSha256,
  });
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'symbolic-link',
    path: 'originals/linked',
  });
});

test('rejects duplicate original paths', () => {
  const { directory, manifest } = createBackup();
  manifest.originals.push({
    path: 'notes.txt',
    size: noteBytes.length,
    sha256: noteSha256,
  });
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'duplicate-path',
    path: 'notes.txt',
  });
});

test('rejects case-colliding original paths', () => {
  const { directory, manifest } = createBackup();
  manifest.originals.push({
    path: 'NOTES.txt',
    size: noteBytes.length,
    sha256: noteSha256,
  });
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'duplicate-path',
  });
});

test('rejects an original file the manifest does not list', () => {
  const { directory } = createBackup();
  writeFileSync(join(directory, 'originals', 'extra.txt'), noteBytes);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'unexpected-file',
    path: 'originals/extra.txt',
  });
});

test('rejects an undeclared original directory', () => {
  const { directory } = createBackup();
  mkdirSync(join(directory, 'originals', 'other'));
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'unexpected-directory',
    path: 'originals/other',
  });
});

test('rejects malformed manifest JSON', () => {
  const { directory } = createBackup();
  writeFileSync(join(directory, 'manifest.json'), '{not json');
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-manifest',
    path: 'manifest.json',
  });
});

test('rejects a manifest missing a required field', () => {
  const { directory, manifest } = createBackup();
  const incomplete: Partial<Manifest> = { ...manifest };
  delete incomplete.formatVersion;
  saveManifest(directory, incomplete);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-manifest',
    path: 'manifest.json',
  });
});

test('rejects a manifest with an invalid dump hash', () => {
  const { directory, manifest } = createBackup();
  manifest.dump.sha256 = 'A'.repeat(64);
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-manifest',
    path: 'manifest.json',
  });
});

test('rejects malformed inventory metadata', () => {
  const { directory, manifest } = createBackup();
  const invalid: unknown = {
    ...manifest,
    inventory: {
      ...manifest.inventory,
      tables: [
        {
          schema: 'public',
          name: 'fixture_table',
          rows: 2,
          sha256: manifest.inventory.tables[0]?.sha256,
        },
      ],
    },
  };
  saveManifest(directory, invalid);
  const result = verify(directory);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-manifest',
    path: 'manifest.json',
  });
});

test('accepts empty originals and directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'sprout-backup-'));
  roots.push(root);
  const directory = join(root, 'backup');
  mkdirSync(join(directory, 'originals'), { recursive: true });
  writeFileSync(join(directory, 'database.dump'), dumpBytes);
  const manifest = validManifest();
  manifest.originals = [];
  manifest.directories = [];
  saveManifest(directory, manifest);
  const result = verify(directory);
  expect(result.status).toBe(0);
  expect(parseCliResult(result.stdout)).toMatchObject({
    status: 'verified',
    files: 1,
  });
});

test('rejects unsupported options', () => {
  const { directory } = createBackup();
  const result = verify(directory, [
    '--verify-only',
    '--from',
    directory,
    '--seal',
  ]);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-arguments',
  });
});

test('rejects verify-only without a source directory', () => {
  const result = verify('', ['--verify-only']);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'invalid-arguments',
  });
});

test('checks backup bytes before accessing Docker or restore targets', () => {
  const { root, directory } = createBackup();
  writeFileSync(join(directory, 'originals', 'notes.txt'), 'corrupt');
  const target = join(root, 'untouched');
  const result = verify(directory, [
    '--from',
    directory,
    '--database',
    'new_scratch',
    '--originals',
    target,
  ]);
  expect(result.status).toBe(1);
  expect(failure(result.stdout)).toMatchObject({
    reason: 'size-mismatch',
    path: 'originals/notes.txt',
  });
  expect(result.stdout).not.toContain('redaction-probe');
  expect(existsSync(target)).toBe(false);
});

test.each([
  ['--from', 'backup'],
  ['--from', 'backup', '--database', 'new_scratch'],
  [
    '--verify-only',
    '--from',
    'backup',
    '--database',
    'new_scratch',
    '--originals',
    'empty',
  ],
  [
    '--from',
    'backup',
    '--from',
    'other',
    '--database',
    'new_scratch',
    '--originals',
    'empty',
  ],
])('rejects incomplete or mixed restore arguments %j', (...args: string[]) => {
  const result = verify('', args);
  expect(result.status).toBe(1);
  expect(failure(result.stdout).reason).toBe('invalid-arguments');
});
