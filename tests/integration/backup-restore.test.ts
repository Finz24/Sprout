import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { expect, test } from 'vitest';

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function command({
  executable,
  args,
  env = process.env,
  input,
}: {
  executable: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  input?: string;
}): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, {
      env,
      windowsHide: true,
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.stdin.once('error', reject);
    child.once('close', (status) => resolveResult({ status, stdout, stderr }));
    child.stdin.end(input);
  });
}

function successful(result: CommandResult, operation: string): string {
  expect(
    result.status,
    `${operation}\n${result.stdout}\n${result.stderr}`,
  ).toBe(0);
  return result.stdout.trim();
}

function jsonRows(output: string): unknown {
  const rows: unknown = JSON.parse(
    `[${output.trim().split('\n').filter(Boolean).join(',')}]`,
  );
  return rows;
}

function backupRole() {
  for (const candidate of [
    process.env.SPROUT_BACKUP_DATABASE_URL,
    process.env.DATABASE_URL,
  ]) {
    if (!candidate) {
      continue;
    }
    try {
      const url = new URL(candidate);
      if (
        (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
        url.username
      ) {
        return {
          user: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
        };
      }
    } catch {
      // Ignore non-URL sentinels. The password stays in the process environment.
    }
  }
  return {
    user: 'sprout',
    password: process.env.POSTGRES_PASSWORD ?? '',
  };
}

function roleUrl(
  hostPort: string,
  database: string,
  role: { user: string; password: string },
) {
  const user = encodeURIComponent(role.user);
  const auth = role.password
    ? `${user}:${encodeURIComponent(role.password)}`
    : user;
  return `postgresql://${auth}@${hostPort}/${database}`;
}

async function committedHistory() {
  const folder = resolve('packages/database/migrations');
  const journal: unknown = JSON.parse(
    await readFile(join(folder, 'meta/_journal.json'), 'utf8'),
  );
  if (
    typeof journal !== 'object' ||
    journal === null ||
    !('entries' in journal) ||
    !Array.isArray(journal.entries)
  ) {
    throw new Error('Committed migration journal must contain entries.');
  }
  const entries: unknown[] = journal.entries;
  return Promise.all(
    entries.map(async (entry) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('tag' in entry) ||
        typeof entry.tag !== 'string' ||
        !('when' in entry) ||
        typeof entry.when !== 'number'
      ) {
        throw new Error('Committed migrations must have a tag and timestamp.');
      }
      const bytes = await readFile(join(folder, `${entry.tag}.sql`));
      return [
        createHash('sha256').update(bytes).digest('hex'),
        String(entry.when),
      ];
    }),
  );
}

async function removeScratchDirectory(root: string) {
  const withinTemp = relative(resolve(tmpdir()), resolve(root));
  if (
    withinTemp.startsWith('..') ||
    withinTemp.includes(sep) ||
    !withinTemp.startsWith('sprout-backup-integration-')
  ) {
    throw new Error("Cleanup may only remove this test's own temporary root.");
  }
  await rm(root, { recursive: true, force: true });
  expect(existsSync(root)).toBe(false);
}

test('backs up and restores independent PostgreSQL and originals fixtures, refusing unsafe targets', async () => {
  const project = process.env.COMPOSE_PROJECT_NAME ?? 'sprout';
  const prefix = `sprout_backup_it_${randomUUID().replaceAll('-', '')}`;
  const source = `${prefix}_source`;
  const restored = `${prefix}_restored`;
  const existing = `${prefix}_existing`;
  const blocked = `${prefix}_blocked`;
  const mismatched = `${prefix}_mismatched`;
  const databases = [source, restored, existing, blocked, mismatched];
  const root = await mkdtemp(join(tmpdir(), 'sprout-backup-integration-'));
  const originals = join(root, 'synthetic-originals');
  const destination = join(root, 'backup');
  const restoredOriginals = join(root, 'restored-originals');
  const rejectedOriginals = join(root, 'rejected-originals');
  const nonemptyOriginals = join(root, 'nonempty-originals');
  const role = backupRole();
  const hostPort = `127.0.0.1:${process.env.SPROUT_DB_PORT ?? '54329'}`;
  const databaseUrl = roleUrl('postgres:5432', source, role);
  const hostDatabaseUrl = roleUrl(hostPort, source, role);
  const backupScript = resolve('scripts/backup-workspace.mjs');
  const cliEnv = {
    ...process.env,
    COMPOSE_PROJECT_NAME: project,
    SPROUT_BACKUP_DATABASE_URL: databaseUrl,
    SPROUT_BACKUP_ORIGINALS_DIR: originals,
  };
  const noteBytes = Buffer.from('Synthetic Sprout original.\nשלום café 🥬\n');
  const files = [
    {
      path: 'note.txt',
      bytes: noteBytes,
    },
    {
      path: 'nested/cover.bin',
      bytes: Buffer.from([0, 1, 2, 127, 128, 254, 255, 0]),
    },
    { path: 'empty.bin', bytes: Buffer.alloc(0) },
  ];
  const expectedRows = [
    [1, 'repeat', '0001feff'],
    [2, 'repeat', '0001feff'],
    [3, null, null],
    [4, 'שלום café 🥬', ''],
  ];
  const expectedOtherRows = [
    [null, '0001feff'],
    [null, '0001feff'],
    ['שלום café 🥬', ''],
  ];
  const otherTable = '"Backup ""schema"."Rows ""with quotes"';
  const otherSequence = '"Backup ""schema"."Uncalled ""sequence"';
  const envelopeText =
    '-- Dumped from database version literal fixture\n\\restrict literal fixture\n-- PostgreSQL database dump complete';
  let backupWasAvailable = false;

  const compose = (args: string[]) =>
    command({
      executable: 'docker',
      args: ['compose', '-p', project, ...args],
    });
  const sql = async (database: string, input: string) => {
    if (database !== 'postgres' && !databases.includes(database)) {
      throw new Error("SQL is restricted to this test's scratch databases.");
    }
    return successful(
      await command({
        executable: 'docker',
        args: [
          'compose',
          '-p',
          project,
          'exec',
          '-T',
          '-e',
          'PGCLIENTENCODING=UTF8',
          '-e',
          'PGUSER',
          '-e',
          'PGPASSWORD',
          'postgres',
          'psql',
          '-X',
          '-qAt',
          '-v',
          'ON_ERROR_STOP=1',
          '-d',
          database,
        ],
        env: {
          ...process.env,
          PGUSER: role.user,
          PGPASSWORD: role.password,
        },
        input,
      }),
      'Scratch PostgreSQL command',
    );
  };
  const restore = (database: string, folder: string) =>
    command({
      executable: process.execPath,
      args: [
        'scripts/restore-workspace.mjs',
        '--from',
        destination,
        '--database',
        database,
        '--originals',
        folder,
      ],
      env: cliEnv,
    });
  const refused = (result: CommandResult, target: string) => {
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, output).not.toBeNull();
    expect(result.status, output).not.toBe(0);
    expect(output.replaceAll('\\\\', '\\')).toContain(target);
    expect(output).not.toMatch(
      /MODULE_NOT_FOUND|invalid-arguments|internal-error/,
    );
    expect(output).not.toContain(databaseUrl);
    expect(output).not.toContain(hostDatabaseUrl);
    if (role.password) {
      expect(output).not.toContain(role.password);
    }
  };
  const readFixture = async (database: string) => {
    expect(
      jsonRows(
        await sql(
          database,
          "SELECT json_build_array(id, note, encode(payload, 'hex')) FROM public.backup_fixture ORDER BY id;",
        ),
      ),
    ).toEqual(expectedRows);
    expect(
      jsonRows(
        await sql(
          database,
          `SELECT json_build_array(note, encode(payload, 'hex')) FROM ${otherTable} ORDER BY note NULLS FIRST, encode(payload, 'hex');`,
        ),
      ),
    ).toEqual(expectedOtherRows);
  };
  const migrationSql =
    'SELECT json_build_array(hash, created_at::text) FROM drizzle.__drizzle_migrations ORDER BY created_at, id;';
  const runningApps = async () =>
    successful(
      await compose([
        'ps',
        '--status',
        'running',
        '--services',
        'api',
        'worker',
      ]),
      'Read running application services',
    )
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  const backupTo = (folder: string, overrides: NodeJS.ProcessEnv = {}) =>
    command({
      executable: process.execPath,
      args: [backupScript, '--dest', folder],
      env: { ...cliEnv, ...overrides },
    });
  const dropScratchDatabase = async (database: string) => {
    if (!database.startsWith(`${prefix}_`) || !/^[a-z0-9_]+$/.test(database)) {
      throw new Error("Cleanup may only drop this test's generated databases.");
    }
    await sql(
      'postgres',
      `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`,
    );
  };

  try {
    await mkdir(join(originals, 'nested'), { recursive: true });
    await mkdir(join(originals, 'empty-directory'));
    await mkdir(restoredOriginals);
    await mkdir(rejectedOriginals);
    await mkdir(nonemptyOriginals);
    for (const file of files) {
      await writeFile(join(originals, file.path), file.bytes);
    }
    const sentinel = Buffer.from('Synthetic target must remain untouched.\n');
    await writeFile(join(nonemptyOriginals, 'keep.txt'), sentinel);
    await sql(
      'postgres',
      `CREATE DATABASE "${source}" TEMPLATE template0;\nCREATE DATABASE "${existing}" TEMPLATE template0;`,
    );

    const corepackRoot =
      process.env.COREPACK_ROOT ??
      join(
        dirname(process.execPath),
        ...(process.platform === 'win32'
          ? ['node_modules']
          : ['..', 'lib', 'node_modules']),
        'corepack',
      );
    const migration = await command({
      executable: process.execPath,
      args: [join(corepackRoot, 'dist/corepack.js'), 'pnpm', 'migrate'],
      env: {
        ...process.env,
        DATABASE_URL: hostDatabaseUrl,
        MIGRATIONS_DIR: resolve('packages/database/migrations'),
      },
    });
    successful(
      migration,
      'Apply committed migrations through corepack pnpm migrate',
    );
    const expectedHistory = await committedHistory();
    expect(expectedHistory.length).toBeGreaterThan(0);
    expect(jsonRows(await sql(source, migrationSql))).toEqual(expectedHistory);
    await sql(
      source,
      `
      CREATE TABLE public.backup_fixture (id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, note text, payload bytea);
      INSERT INTO public.backup_fixture (note, payload) VALUES
        ('repeat', decode('0001feff', 'hex')), ('repeat', decode('0001feff', 'hex')),
        (NULL, NULL), ('שלום café 🥬', decode('', 'hex'));
      SELECT setval(pg_get_serial_sequence('public.backup_fixture', 'id'), 41, true);
      CREATE SCHEMA "Backup ""schema";
      CREATE TABLE ${otherTable} (note text, payload bytea);
      INSERT INTO ${otherTable} VALUES
        (NULL, decode('0001feff', 'hex')), (NULL, decode('0001feff', 'hex')),
        ('שלום café 🥬', decode('', 'hex'));
      CREATE SEQUENCE ${otherSequence} START 73;
      ALTER TABLE public.backup_fixture ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.backup_fixture FORCE ROW LEVEL SECURITY;
      CREATE POLICY synthetic_policy ON public.backup_fixture USING (false);
      GRANT SELECT ON public.backup_fixture TO PUBLIC;
      CREATE FUNCTION public.backup_envelope_fixture() RETURNS text LANGUAGE sql
        AS $body$ SELECT $literal$${envelopeText}$literal$; $body$;
      CREATE TABLE public.backup_partitions (id integer, raw json) PARTITION BY RANGE (id);
      CREATE TABLE public.backup_partition_a PARTITION OF public.backup_partitions FOR VALUES FROM (0) TO (10);
      INSERT INTO public.backup_partitions VALUES (1, '{"a": 1, "b":2}'), (2, '{ "a":1,"b":2 }');
    `,
    );
    await readFixture(source);

    backupWasAvailable = existsSync(backupScript);
    const backup = await backupTo(destination, {
      SPROUT_BACKUP_DATABASE_URL: hostDatabaseUrl,
    });
    expect(`${backup.stdout}\n${backup.stderr}`).not.toContain(databaseUrl);
    expect(`${backup.stdout}\n${backup.stderr}`).not.toContain(hostDatabaseUrl);
    if (role.password) {
      expect(`${backup.stdout}\n${backup.stderr}`).not.toContain(role.password);
    }
    successful(backup, 'Back up scratch database and synthetic originals');
    for (const url of [
      process.env.API_URL ?? 'http://127.0.0.1:3001',
      process.env.WORKER_URL ?? 'http://127.0.0.1:3002',
    ]) {
      await expect
        .poll(
          async () => {
            try {
              return (
                await fetch(`${url}/health/ready`, {
                  signal: AbortSignal.timeout(3_000),
                })
              ).status;
            } catch {
              return 0;
            }
          },
          {
            timeout: 30_000,
            message: 'Backup must restart the running API and worker',
          },
        )
        .toBe(200);
    }
    successful(
      await command({
        executable: process.execPath,
        args: [
          'scripts/restore-workspace.mjs',
          '--verify-only',
          '--from',
          destination,
        ],
        env: cliEnv,
      }),
      'Verify the produced backup',
    );

    const restoredResult = await restore(restored, restoredOriginals);
    expect(`${restoredResult.stdout}\n${restoredResult.stderr}`).not.toContain(
      databaseUrl,
    );
    expect(`${restoredResult.stdout}\n${restoredResult.stderr}`).not.toContain(
      hostDatabaseUrl,
    );
    if (role.password) {
      expect(
        `${restoredResult.stdout}\n${restoredResult.stderr}`,
      ).not.toContain(role.password);
    }
    successful(
      restoredResult,
      'Restore into a new database and empty originals folder',
    );
    await readFixture(restored);
    expect(
      await sql(restored, 'SELECT public.backup_envelope_fixture();'),
    ).toBe(envelopeText);
    expect(
      jsonRows(
        await sql(
          restored,
          'SELECT json_build_array(id, raw::text) FROM public.backup_partitions ORDER BY id;',
        ),
      ),
    ).toEqual([
      [1, '{"a": 1, "b":2}'],
      [2, '{ "a":1,"b":2 }'],
    ]);
    expect(
      await sql(
        restored,
        "SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.backup_fixture'::regclass;",
      ),
    ).toBe('t');
    expect(
      await sql(
        restored,
        "SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'backup_fixture' AND policyname = 'synthetic_policy';",
      ),
    ).toBe('false');
    expect(
      await sql(
        restored,
        "SELECT privilege_type FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = 'backup_fixture' AND grantee = 'PUBLIC';",
      ),
    ).toBe('SELECT');
    expect(jsonRows(await sql(restored, migrationSql))).toEqual(
      expectedHistory,
    );
    expect(
      await sql(
        restored,
        'SELECT last_value, is_called FROM public.backup_fixture_id_seq;',
      ),
    ).toBe('41|t');
    expect(
      await sql(
        restored,
        `SELECT last_value, is_called FROM ${otherSequence};`,
      ),
    ).toBe('73|f');
    expect(
      await sql(
        restored,
        "INSERT INTO public.backup_fixture (note) VALUES ('after restore') RETURNING id;",
      ),
    ).toBe('42');
    expect(await sql(restored, `SELECT nextval('${otherSequence}');`)).toBe(
      '73',
    );
    const restoredEntries = await readdir(restoredOriginals, {
      recursive: true,
    });
    expect(
      restoredEntries.map((entry) => entry.split(sep).join('/')).sort(),
    ).toEqual(
      [
        'empty-directory',
        'empty.bin',
        'nested',
        'nested/cover.bin',
        'note.txt',
      ].sort(),
    );
    for (const file of files) {
      const actualBytes = await readFile(join(restoredOriginals, file.path));
      expect(actualBytes.length, file.path).toBe(file.bytes.length);
      expect(
        createHash('sha256').update(actualBytes).digest('hex'),
        file.path,
      ).toBe(createHash('sha256').update(file.bytes).digest('hex'));
    }

    refused(await restore(source, rejectedOriginals), source);
    await readFixture(source);
    expect(await readdir(rejectedOriginals)).toEqual([]);
    refused(await restore(existing, rejectedOriginals), existing);
    expect(
      await sql(
        existing,
        "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'S');",
      ),
    ).toBe('0');
    refused(await restore(blocked, nonemptyOriginals), nonemptyOriginals);
    expect(await readFile(join(nonemptyOriginals, 'keep.txt'))).toEqual(
      sentinel,
    );
    expect(await readdir(nonemptyOriginals)).toEqual(['keep.txt']);
    expect(
      await sql(
        'postgres',
        `SELECT count(*) FROM pg_database WHERE datname = '${blocked}';`,
      ),
    ).toBe('0');
    refused(await restore('sprout', rejectedOriginals), 'sprout');
    refused(
      await restore(blocked, '/workspace/originals'),
      '/workspace/originals',
    );
    expect(await readdir(rejectedOriginals)).toEqual([]);
    expect(
      await sql(
        'postgres',
        `SELECT count(*) FROM pg_database WHERE datname = '${blocked}';`,
      ),
    ).toBe('0');

    const alias = join(root, 'linked-target');
    await symlink(
      rejectedOriginals,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    refused(await restore(blocked, join(alias, 'new-folder')), alias);
    expect(await readdir(rejectedOriginals)).toEqual([]);
    refused(await restore(blocked, originals), originals);
    refused(
      await restore(blocked, join(destination, 'new-folder')),
      join(destination, 'new-folder'),
    );
    refused(await backupTo(destination), destination);
    successful(
      await command({
        executable: process.execPath,
        args: [
          'scripts/restore-workspace.mjs',
          '--verify-only',
          '--from',
          destination,
        ],
        env: { ...cliEnv, PATH: '' },
      }),
      'Existing backup stays verifiable without Docker',
    );

    const manifestPath = join(destination, 'manifest.json');
    const originalManifest = await readFile(manifestPath);
    const metadata: unknown = JSON.parse(originalManifest.toString('utf8'));
    if (
      typeof metadata !== 'object' ||
      metadata === null ||
      !('inventory' in metadata) ||
      typeof metadata.inventory !== 'object' ||
      metadata.inventory === null ||
      !('objects' in metadata.inventory) ||
      !Array.isArray(metadata.inventory.objects)
    ) {
      throw new Error('Backup must include a schema inventory.');
    }
    const objects: unknown[] = metadata.inventory.objects;
    const schema = objects[0];
    if (
      typeof schema !== 'object' ||
      schema === null ||
      !('definition' in schema) ||
      typeof schema.definition !== 'string'
    ) {
      throw new Error('Backup must include a complete schema definition.');
    }
    expect(schema.definition).toContain(envelopeText);
    schema.definition = schema.definition.replace(
      '-- Dumped from database version literal fixture',
      '-- Dumped from database version changed fixture',
    );
    try {
      await writeFile(manifestPath, JSON.stringify(metadata));
      const incompleteOriginals = join(root, 'incomplete-originals');
      refused(
        await restore(mismatched, incompleteOriginals),
        'database-schema',
      );
      // Failed proof retains the newly restored artifacts for diagnosis.
      expect(
        await sql(
          'postgres',
          `SELECT count(*) FROM pg_database WHERE datname = '${mismatched}';`,
        ),
      ).toBe('1');
      expect(await readFile(join(incompleteOriginals, 'note.txt'))).toEqual(
        noteBytes,
      );
    } finally {
      await writeFile(manifestPath, originalManifest);
    }

    const corruptFile = join(destination, 'originals', 'note.txt');
    await writeFile(corruptFile, 'damaged');
    refused(await restore(blocked, rejectedOriginals), 'originals/note.txt');
    expect(await readdir(rejectedOriginals)).toEqual([]);
    expect(
      await sql(
        'postgres',
        `SELECT count(*) FROM pg_database WHERE datname = '${blocked}';`,
      ),
    ).toBe('0');
    await writeFile(corruptFile, noteBytes);

    const unrelated = await backupTo(join(root, 'unrelated'), {
      SPROUT_BACKUP_DATABASE_URL: `postgresql://sprout:private-endpoint-probe@unrelated.invalid:5432/${source}`,
    });
    refused(unrelated, 'invalid-database-endpoint');
    expect(`${unrelated.stdout}\n${unrelated.stderr}`).not.toContain(
      'private-endpoint-probe',
    );

    const image = successful(
      await compose(['images', '--quiet', 'postgres']),
      'Read the prepared database image',
    );
    const lease = successful(
      await command({
        executable: 'docker',
        args: [
          'create',
          '--pull',
          'never',
          '--network',
          'none',
          '--name',
          `${project}-backup-lock`,
          image,
          'true',
        ],
      }),
      'Own a synthetic backup lease',
    );
    try {
      const before = await runningApps();
      refused(await backupTo(join(root, 'locked-backup')), 'create');
      expect(await runningApps()).toEqual(before);
      expect(existsSync(join(root, 'locked-backup'))).toBe(false);
    } finally {
      successful(
        await command({ executable: 'docker', args: ['rm', lease] }),
        'Release only our synthetic lease',
      );
    }

    // Only the API is running when this backup fails. It must return to exactly that state.
    successful(
      await compose(['stop', 'worker']),
      'Stop only the isolated worker for service-state proof',
    );
    expect(await runningApps()).toEqual(['api']);
    await sql(
      source,
      `CREATE FOREIGN DATA WRAPPER backup_unsupported;
      CREATE SERVER backup_external FOREIGN DATA WRAPPER backup_unsupported;
      CREATE FOREIGN TABLE public.backup_external (id integer) SERVER backup_external;`,
    );
    const failedDestination = join(root, 'failed-backup');
    refused(await backupTo(failedDestination), 'database');
    expect(existsSync(failedDestination)).toBe(false);
    expect(await runningApps()).toEqual(['api']);
    await readFixture(source);
    await sql(
      source,
      `DROP FOREIGN TABLE public.backup_external;
      DROP SERVER backup_external; DROP FOREIGN DATA WRAPPER backup_unsupported;`,
    );
    await sql(
      source,
      'UPDATE drizzle.__drizzle_migrations SET created_at = created_at + 1;',
    );
    refused(
      await backupTo(join(root, 'bad-history')),
      'drizzle.__drizzle_migrations',
    );
    expect(existsSync(join(root, 'bad-history'))).toBe(false);
    expect(await runningApps()).toEqual(['api']);
  } finally {
    try {
      if (backupWasAvailable) {
        successful(
          await compose(['up', '-d', '--no-deps', '--wait', 'api', 'worker']),
          'Keep API and worker running after the restore exercise',
        );
      }
    } finally {
      try {
        for (const database of databases) {
          await dropScratchDatabase(database);
        }
        expect(
          await sql(
            'postgres',
            `SELECT count(*) FROM pg_database WHERE datname IN (${databases.map((database) => `'${database}'`).join(',')});`,
          ),
        ).toBe('0');
      } finally {
        await removeScratchDirectory(root);
      }
      console.info(`Scratch cleanup verified for ${prefix} and ${root}.`);
    }
  }
}, 300_000);
