import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from 'pg';
import {
  createPool,
  transaction,
  validateRole,
} from '../../packages/database/src/private-storage.js';
import { createIdentityAuth } from '../../packages/database/src/identity.js';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createOwner } from '../../packages/database/src/bootstrap.js';
import { provisionSyntheticOwner } from '../../packages/database/src/test-fixtures.js';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3001';
const origin =
  process.env.SPROUT_ORIGIN ?? process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const adminUrl = process.env.DATABASE_URL;
const maintenanceUrl = process.env.MAINTENANCE_DATABASE_URL;
const owner = {
  name: process.env.SPROUT_OWNER_NAME ?? 'Sprout Owner',
  email: process.env.SPROUT_TEST_EMAIL ?? 'owner@example.invalid',
  password: process.env.SPROUT_TEST_PASSWORD ?? 'synthetic-password-for-tests',
};
const other = {
  name: 'Second Owner',
  email: 'second-owner@example.invalid',
  password: 'synthetic-second-password',
};
const admin = adminUrl
  ? new Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 })
  : undefined;

const json = async (response: Response): Promise<unknown> => {
  const body: unknown = JSON.parse(await response.text());
  return body;
};
const cookieHeader = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0] ?? '')
    .filter(Boolean)
    .join('; ');
const api = (path: string, init: RequestInit = {}) =>
  fetch(`${apiUrl}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
const authHeaders = (cookie: string) => ({
  cookie,
  origin,
  'content-type': 'application/json',
});
const signIn = (
  email = owner.email,
  password = owner.password,
  requestOrigin = origin,
) =>
  api('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
async function signedIn(email = owner.email, password = owner.password) {
  const response = await signIn(email, password);
  expect(response.status).toBe(200);
  const cookie = cookieHeader(response);
  expect(cookie.includes('sprout.session_token=')).toBe(true);
  return cookie;
}
async function count(table: string) {
  if (!admin) throw new Error('DATABASE_URL is required');
  const result = await admin.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table}`,
  );
  return Number(result.rows[0]?.count);
}
const withApplicationName = (url: string, name: string) => {
  const parsed = new URL(url);
  parsed.searchParams.set('application_name', name);
  return parsed.toString();
};

beforeAll(async () => {
  if (!adminUrl || !maintenanceUrl)
    throw new Error('DATABASE_URL and MAINTENANCE_DATABASE_URL are required');
  await admin?.connect();
  expect(await count('auth."user"')).toBe(0);
  expect(await count('auth.account')).toBe(0);
  expect(await count('auth.session')).toBe(0);
  expect(await count('auth.verification')).toBe(0);
  expect(await count('private.owner_settings')).toBe(0);
});
afterAll(async () => {
  if (admin) await admin.end();
});

describe.sequential('private authentication', () => {
  test('an interrupted first-owner bootstrap leaves no partial installation', async () => {
    if (!admin || !maintenanceUrl)
      throw new Error('Database configuration is required');
    const interruptedUrl = withApplicationName(
      maintenanceUrl,
      'sprout-bootstrap-interrupt',
    );
    await admin.query(`
      CREATE FUNCTION private.slow_owner_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_sleep(30);
        RETURN NEW;
      END $$;
      CREATE TRIGGER slow_owner_insert BEFORE INSERT ON private.owner_settings
      FOR EACH ROW EXECUTE FUNCTION private.slow_owner_insert();
    `);
    try {
      const pending = createOwner(interruptedUrl, owner).catch(
        (error: unknown) => error,
      );
      let terminated = false;
      for (let attempt = 0; attempt < 40 && !terminated; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const rows = await admin.query<{ pid: number }>(
          "SELECT pid FROM pg_stat_activity WHERE application_name = 'sprout-bootstrap-interrupt' AND state = 'active'",
        );
        for (const row of rows.rows) {
          const result = await admin.query<{ terminated: boolean }>(
            'SELECT pg_terminate_backend($1) AS terminated',
            [row.pid],
          );
          if (result.rows[0]?.terminated) terminated = true;
        }
      }
      expect(terminated).toBe(true);
      expect(await pending).toBeInstanceOf(Error);
      expect(await count('auth."user"')).toBe(0);
      for (const table of [
        'auth.account',
        'auth.session',
        'auth.verification',
        'private.owner_settings',
      ])
        expect(await count(table)).toBe(0);
    } finally {
      await admin.query(
        'DROP TRIGGER IF EXISTS slow_owner_insert ON private.owner_settings',
      );
      await admin.query('DROP FUNCTION IF EXISTS private.slow_owner_insert()');
    }
  }, 30000);

  test('a bootstrap race creates exactly one complete owner', async () => {
    if (!maintenanceUrl)
      throw new Error('MAINTENANCE_DATABASE_URL is required');
    const results = await Promise.all([
      createOwner(maintenanceUrl, owner),
      createOwner(maintenanceUrl, owner),
    ]);
    expect(results.sort()).toEqual(['AlreadyProvisioned', 'Created']);
    expect(await count('auth."user"')).toBe(1);
    expect(await count('auth.account')).toBe(1);
    expect(await count('private.owner_settings')).toBe(1);
    expect(await createOwner(maintenanceUrl, owner)).toBe('AlreadyProvisioned');
    expect(await count('auth.session')).toBe(0);
    expect(await count('auth.verification')).toBe(0);
  }, 30000);

  test('an inconsistent installation cannot gain another owner', async () => {
    if (!admin || !maintenanceUrl)
      throw new Error('Database configuration is required');
    const extraId = randomUUID();
    await admin.query(
      'INSERT INTO auth."user" (id, name, email) VALUES ($1, $2, $3)',
      [extraId, 'Incomplete', 'incomplete@example.invalid'],
    );
    try {
      expect(await createOwner(maintenanceUrl, owner)).toBe(
        'InconsistentInstallation',
      );
      expect(await count('auth."user"')).toBe(2);
    } finally {
      await admin.query('DELETE FROM auth."user" WHERE id = $1', [extraId]);
    }
    expect(await count('auth."user"')).toBe(1);
  }, 30000);

  test('sign-in sets a host-only HttpOnly Lax cookie and returns no session token', async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ success: true });
    const setCookies = response.headers.getSetCookie();
    const sessionCookie = setCookies.find((value) =>
      value.startsWith('sprout.session_token='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie).not.toContain('Secure');
    expect(sessionCookie).not.toContain('Domain=');
  });

  test('session and shell responses never expose a bearer token', async () => {
    const cookie = await signedIn();
    const session = await api('/api/session', { headers: { cookie } });
    expect(session.status).toBe(200);
    const sessionBody = await json(session);
    expect(sessionBody).toMatchObject({
      kind: 'Authenticated',
      owner: { name: owner.name, email: owner.email },
    });
    expect(sessionBody).toHaveProperty('expiresAt', expect.any(String));
    const shell = await api('/api/shell', { headers: { cookie } });
    expect(shell.status).toBe(200);
    const body = await json(shell);
    expect(body).toEqual({
      owner: { name: owner.name, email: owner.email },
      libraryView: 'grid',
    });
    expect(JSON.stringify(body)).not.toContain('token');
    const anonymous = await api('/api/shell');
    expect(anonymous.status).toBe(401);
  });

  test('sign-up is unreachable and unexpected methods or paths are rejected', async () => {
    const before = await count('auth."user"');
    for (const path of [
      '/api/auth/sign-up/email',
      '/api/auth/sign-%75p/email',
      '/api/auth/session',
      '/api/auth/sign-up%2femail',
      '/api/auth/bootstrap',
      '/api/auth/durable-sign-out',
    ]) {
      const response = await api(path, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: '{}',
      });
      expect(response.status).toBe(404);
    }
    const method = await api('/api/auth/sign-out', { headers: { origin } });
    expect(method.status).toBe(404);
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      expect(
        (await api('/api/auth/sign-up/email', { method, headers: { origin } }))
          .status,
      ).toBe(404);
    }
    expect(
      (
        await api('/api/shell', {
          headers: { cookie: 'sprout.session_token=forged' },
        })
      ).status,
    ).toBe(401);
    expect(await count('auth."user"')).toBe(before);
  });

  test('origin and JSON content-type checks reject cross-site or form posts', async () => {
    const wrongOrigin = await signIn(
      owner.email,
      owner.password,
      'http://attacker.invalid',
    );
    expect(wrongOrigin.status).toBe(403);
    const form = await api('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=x&password=y',
    });
    expect(form.status).toBe(403);
  });

  test('two owners see only their own persisted preference', async () => {
    if (!maintenanceUrl)
      throw new Error('MAINTENANCE_DATABASE_URL is required');
    await provisionSyntheticOwner(maintenanceUrl, other);
    const first = await signedIn();
    const second = await signedIn(other.email, other.password);
    const update = await api('/api/settings/library-view', {
      method: 'PUT',
      headers: authHeaders(second),
      body: JSON.stringify({ libraryView: 'list' }),
    });
    expect(update.status).toBe(200);
    const secondShell = await api('/api/shell', {
      headers: { cookie: second },
    });
    const firstShell = await api('/api/shell', { headers: { cookie: first } });
    expect(await json(secondShell)).toMatchObject({
      owner: { email: other.email },
      libraryView: 'list',
    });
    expect(await json(firstShell)).toMatchObject({
      owner: { email: owner.email },
      libraryView: 'grid',
    });
  });

  test('an expired session cannot read private state', async () => {
    if (!admin) throw new Error('DATABASE_URL is required');
    const cookie = await signedIn();
    await admin.query(
      'UPDATE auth.session SET expires_at = now() - interval \'1 second\' WHERE user_id = (SELECT id FROM auth."user" WHERE email = $1)',
      [owner.email],
    );
    const shell = await api('/api/shell', { headers: { cookie } });
    expect(shell.status).toBe(401);
    const session = await api('/api/session', { headers: { cookie } });
    expect(await json(session)).toEqual({ kind: 'Anonymous' });
  });

  test('sign-out keeps the cookie and session when revocation fails, then revokes on retry', async () => {
    if (!admin) throw new Error('DATABASE_URL is required');
    const cookie = await signedIn();
    const sessionsBefore = await count('auth.session');
    await admin.query('REVOKE DELETE ON auth.session FROM sprout_auth');
    try {
      const failed = await api('/api/auth/sign-out', {
        method: 'POST',
        headers: authHeaders(cookie),
        body: '{}',
      });
      expect(failed.status).toBe(503);
      expect(failed.headers.getSetCookie()).toEqual([]);
      expect(await count('auth.session')).toBe(sessionsBefore);
      const stillPrivate = await api('/api/shell', { headers: { cookie } });
      expect(stillPrivate.status).toBe(200);
    } finally {
      await admin.query('GRANT DELETE ON auth.session TO sprout_auth');
    }
    const revoked = await api('/api/auth/sign-out', {
      method: 'POST',
      headers: authHeaders(cookie),
      body: '{}',
    });
    expect(revoked.status).toBe(200);
    expect(
      revoked.headers
        .getSetCookie()
        .some(
          (value) =>
            value.startsWith('sprout.session_token=') &&
            value.includes('Max-Age=0'),
        ),
    ).toBe(true);
    const replay = await api('/api/shell', { headers: { cookie } });
    expect(replay.status).toBe(401);
    expect(
      (
        await api('/api/auth/sign-out', {
          method: 'POST',
          headers: authHeaders(cookie),
          body: '{}',
        })
      ).status,
    ).toBe(200);
    expect(await count('auth.session')).toBe(sessionsBefore - 1);
  });

  test('session expiry is seven days absolute and reads do not slide it', async () => {
    if (!admin) throw new Error('Database configuration is required');
    const cookie = await signedIn();
    const latest = await admin.query<{
      id: string;
      lifetime: number;
      expires_at: Date;
    }>(
      `SELECT id, expires_at, extract(epoch FROM (expires_at - created_at))::float AS lifetime
       FROM auth.session WHERE user_id = (SELECT id FROM auth."user" WHERE email = $1)
       ORDER BY created_at DESC LIMIT 1`,
      [owner.email],
    );
    const row = latest.rows[0];
    if (!row) throw new Error('Expected a persisted session');
    expect(row.lifetime).toBeGreaterThan(604795);
    expect(row.lifetime).toBeLessThanOrEqual(604800);
    await admin.query(
      "UPDATE auth.session SET created_at = now() - interval '3 days', updated_at = now() - interval '3 days' WHERE id = $1",
      [row.id],
    );
    for (let read = 0; read < 2; read++)
      expect((await api('/api/shell', { headers: { cookie } })).status).toBe(
        200,
      );
    const after = await admin.query<{ expires_at: Date }>(
      'SELECT expires_at FROM auth.session WHERE id = $1',
      [row.id],
    );
    expect(after.rows[0]?.expires_at.getTime()).toBe(row.expires_at.getTime());
  });

  test('runtime create hook and SQL grants independently deny registration', async () => {
    const authUrl = process.env.AUTH_DATABASE_URL;
    if (!authUrl) throw new Error('Runtime auth configuration is required');
    const pool = createPool(authUrl, 1);
    const before = await Promise.all(
      ['auth."user"', 'auth.account'].map(count),
    );
    try {
      const auth = createIdentityAuth(
        {
          authUrl,
          privateUrl: '',
          origin,
          secret: process.env.BETTER_AUTH_SECRET ?? '',
          loopbackDevelopment: true,
          maxConnections: 1,
        },
        pool,
      );
      const context = await auth.$context;
      await expect(
        context.internalAdapter.createUser({
          name: 'Denied',
          email: 'denied@example.invalid',
          emailVerified: false,
        }),
      ).rejects.toThrow('Provisioning is local only');
      for (const statement of [
        `INSERT INTO auth."user" (id,name,email) VALUES ('denied','Denied','denied@example.invalid')`,
        `INSERT INTO auth.account (id,user_id,account_id,provider_id) VALUES ('denied','denied','denied','credential')`,
      ])
        await expect(pool.query(statement)).rejects.toMatchObject({
          code: '42501',
        });
      expect(
        await Promise.all(['auth."user"', 'auth.account'].map(count)),
      ).toEqual(before);
    } finally {
      await pool.end();
    }
  });

  test('actual runtime roles reject escalation, foreign IDs and forged identity', async () => {
    if (!admin) throw new Error('Database configuration is required');
    const urls = [
      process.env.API_DATABASE_URL,
      process.env.AUTH_DATABASE_URL,
      process.env.WORKER_DATABASE_URL,
    ];
    const roles = ['sprout_api', 'sprout_auth', 'sprout_worker'] as const;
    for (const [index, role] of roles.entries()) {
      const url = urls[index];
      if (!url) throw new Error('Runtime role configuration is required');
      const pool = createPool(url, 1);
      try {
        await validateRole(pool, role);
        for (const statement of [
          'SET ROLE sprout_schema_owner',
          'SET ROLE sprout_maintenance',
          'SET ROLE sprout_resolver',
          'CREATE ROLE denied_escalation',
        ]) {
          await expect(pool.query(statement)).rejects.toMatchObject({
            code: '42501',
          });
        }
        if (role === 'sprout_worker') {
          await pool.query(
            "SELECT set_config('sprout.owner_id', 'forged-owner', false), set_config('sprout.session_token', 'forged-token', false)",
          );
          await expect(
            pool.query('SELECT * FROM private.owner_settings'),
          ).rejects.toMatchObject({ code: '42501' });
          await expect(
            pool.query('SELECT private.current_owner_id()'),
          ).rejects.toMatchObject({ code: '42501' });
          for (const username of ['sprout_api', 'sprout_auth']) {
            const forged = new URL(url);
            forged.username = username;
            const client = new Client({
              connectionString: forged.toString(),
              connectionTimeoutMillis: 1500,
            });
            try {
              await expect(client.connect()).rejects.toMatchObject({
                code: '28P01',
              });
            } finally {
              await client.end();
            }
          }
        }
      } finally {
        await pool.end();
      }
    }
    const url = process.env.API_DATABASE_URL;
    if (!url) throw new Error('API role configuration is required');
    const pool = createPool(url, 1);
    try {
      const owners = await admin.query<{ id: string; email: string }>(
        'SELECT id,email FROM auth."user" WHERE email IN ($1,$2)',
        [owner.email, other.email],
      );
      const a = owners.rows.find((row) => row.email === owner.email)?.id;
      const b = owners.rows.find((row) => row.email === other.email)?.id;
      if (!a || !b) throw new Error('Two provisioned owners are required');
      const session = await admin.query<{ token: string }>(
        'SELECT token FROM auth.session WHERE user_id = $1 AND expires_at > now() LIMIT 1',
        [b],
      );
      const token = session.rows[0]?.token;
      if (!token) throw new Error('A live second-owner session is required');
      await transaction(pool, new AbortController().signal, async (client) => {
        await client.query('SET LOCAL ROLE sprout_web');
        await client.query(
          "SELECT set_config('sprout.session_token',$1,true),set_config('sprout.owner_id',$2,true)",
          [token, a],
        );
        const read = await client.query<{ owner_user_id: string }>(
          'SELECT owner_user_id FROM private.owner_settings',
        );
        expect(read.rows.map((row) => row.owner_user_id)).toEqual([b]);
        expect(
          (
            await client.query(
              'SELECT 1 FROM private.owner_settings WHERE owner_user_id=$1',
              [a],
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await client.query(
              "UPDATE private.owner_settings SET library_view='list' WHERE owner_user_id=$1",
              [a],
            )
          ).rowCount,
        ).toBe(0);
      });
      await expect(
        transaction(pool, new AbortController().signal, async (client) => {
          await client.query('SET LOCAL ROLE sprout_web');
          await client.query(
            "SELECT set_config('sprout.session_token',$1,true)",
            [token],
          );
          await client.query(
            'UPDATE private.owner_settings SET owner_user_id=$1',
            [a],
          );
        }),
      ).rejects.toMatchObject({ code: '42501' });
      for (const credential of ['', 'forged-token', a]) {
        await transaction(
          pool,
          new AbortController().signal,
          async (client) => {
            await client.query('SET LOCAL ROLE sprout_web');
            await client.query(
              "SELECT set_config('sprout.session_token',$1,true),set_config('sprout.owner_id',$2,true)",
              [credential, a],
            );
            expect(
              (await client.query('SELECT * FROM private.owner_settings'))
                .rowCount,
            ).toBe(0);
            expect(
              (
                await client.query(
                  "UPDATE private.owner_settings SET library_view='grid'",
                )
              ).rowCount,
            ).toBe(0);
          },
        );
      }
    } finally {
      await pool.end();
    }
  });

  test('API validation refuses an elevated web role or web-owned protected objects', async () => {
    const url = process.env.API_DATABASE_URL;
    if (!admin || !url) throw new Error('Database configuration is required');
    const pool = createPool(url, 1);
    try {
      await validateRole(pool, 'sprout_api');
      for (const [unsafe, restored] of [
        ['BYPASSRLS', 'NOBYPASSRLS'],
        ['SUPERUSER', 'NOSUPERUSER'],
        ['CREATEDB', 'NOCREATEDB'],
        ['CREATEROLE', 'NOCREATEROLE'],
        ['REPLICATION', 'NOREPLICATION'],
        ['LOGIN', 'NOLOGIN'],
      ] as const) {
        try {
          await admin.query(`ALTER ROLE sprout_web ${unsafe}`);
          await expect(validateRole(pool, 'sprout_api')).rejects.toMatchObject({
            _tag: 'Unavailable',
          });
          if (unsafe === 'BYPASSRLS') {
            const reservation = createServer();
            await new Promise<void>((resolve) => {
              reservation.listen(0, '127.0.0.1', resolve);
            });
            const address = reservation.address();
            if (!address || typeof address === 'string')
              throw new Error('Expected an isolated startup port');
            await new Promise<void>((resolve) => {
              reservation.close(() => resolve());
            });
            const serving = Object.fromEntries(
              Object.entries(process.env).filter(
                ([name]) =>
                  !/DATABASE_URL|PASSWORD|SECRET|OWNER_|TEST_|MIGRATION/.test(
                    name,
                  ),
              ),
            );
            const child = spawn(
              process.execPath,
              [
                '--import',
                'tsx',
                '--conditions=development',
                'apps/api/src/main.ts',
              ],
              {
                env: {
                  ...serving,
                  DATABASE_URL: url,
                  AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL,
                  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
                  SPROUT_ORIGIN: origin,
                  SPROUT_LOOPBACK_DEVELOPMENT: 'true',
                  HOST: '127.0.0.1',
                  PORT: String(address.port),
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
              },
            );
            let output = '';
            for (const stream of [child.stdout, child.stderr])
              stream?.on('data', (chunk: Buffer) => {
                output += chunk.toString();
              });
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
              const code = await new Promise<number | null>(
                (resolve, reject) => {
                  child.once('error', reject);
                  child.once('close', resolve);
                  timeout = setTimeout(() => resolve(null), 30000);
                },
              );
              expect(code).toBe(1);
              expect(output.includes('DatabaseUnavailable')).toBe(true);
              expect(output.includes('Listening')).toBe(false);
            } finally {
              clearTimeout(timeout);
              if (child.exitCode === null) child.kill();
            }
          }
        } finally {
          await admin.query(`ALTER ROLE sprout_web ${restored}`);
        }
        await validateRole(pool, 'sprout_api');
      }
      for (const [object, owner, restoreGrants] of [
        [
          'TABLE private.owner_settings',
          'sprout_schema_owner',
          'GRANT SELECT ON private.owner_settings TO sprout_web; GRANT UPDATE (library_view, updated_at) ON private.owner_settings TO sprout_web',
        ],
        [
          'TABLE auth.session',
          'sprout_schema_owner',
          'REVOKE ALL ON auth.session FROM sprout_web',
        ],
        [
          'FUNCTION private.current_owner_id()',
          'sprout_resolver',
          'GRANT EXECUTE ON FUNCTION private.current_owner_id() TO sprout_web',
        ],
        [
          'SCHEMA private',
          'sprout_schema_owner',
          'GRANT USAGE ON SCHEMA private TO sprout_web',
        ],
      ] as const) {
        try {
          await admin.query(`ALTER ${object} OWNER TO sprout_web`);
          await expect(validateRole(pool, 'sprout_api')).rejects.toMatchObject({
            _tag: 'Unavailable',
          });
        } finally {
          await admin.query(`ALTER ${object} OWNER TO ${owner}`);
          await admin.query(restoreGrants);
        }
        await validateRole(pool, 'sprout_api');
      }
      try {
        await admin.query('GRANT sprout_resolver TO sprout_web');
        await expect(validateRole(pool, 'sprout_api')).rejects.toMatchObject({
          _tag: 'Unavailable',
        });
      } finally {
        await admin.query('REVOKE sprout_resolver FROM sprout_web');
      }
      await validateRole(pool, 'sprout_api');
      expect((await api('/api/session')).status).toBe(200);
    } finally {
      await pool.end();
    }
  }, 45000);

  test('HTTP disconnect cancels a blocked private update before it can persist', async () => {
    if (!admin || !adminUrl)
      throw new Error('Database configuration is required');
    const cookie = await signedIn();
    const lock = new Client({ connectionString: adminUrl });
    await lock.connect();
    const before = await admin.query<{ library_view: string }>(
      'SELECT library_view FROM private.owner_settings WHERE owner_user_id=(SELECT id FROM auth."user" WHERE email=$1)',
      [owner.email],
    );
    const controller = new AbortController();
    try {
      await lock.query('BEGIN');
      await lock.query(
        'LOCK TABLE private.owner_settings IN ACCESS EXCLUSIVE MODE',
      );
      const pending = fetch(`${apiUrl}/api/settings/library-view`, {
        method: 'PUT',
        headers: authHeaders(cookie),
        body: JSON.stringify({ libraryView: 'list' }),
        signal: controller.signal,
      }).catch(() => undefined);
      let blocked = false;
      for (let attempt = 0; attempt < 40 && !blocked; attempt++) {
        const activity = await admin.query<{ blocked: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename='sprout_api' AND wait_event_type='Lock' AND query LIKE 'UPDATE private.owner_settings%') AS blocked",
        );
        blocked = activity.rows[0]?.blocked === true;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(blocked).toBe(true);
      controller.abort();
      await pending;
      await expect
        .poll(
          async () =>
            (
              await admin.query<{ count: string }>(
                "SELECT count(*)::text AS count FROM pg_stat_activity WHERE usename='sprout_api' AND wait_event_type='Lock'",
              )
            ).rows[0]?.count,
        )
        .toBe('0');
      await lock.query('ROLLBACK');
      const after = await admin.query<{ library_view: string }>(
        'SELECT library_view FROM private.owner_settings WHERE owner_user_id=(SELECT id FROM auth."user" WHERE email=$1)',
        [owner.email],
      );
      expect(after.rows).toEqual(before.rows);
      expect((await api('/api/shell', { headers: { cookie } })).status).toBe(
        200,
      );
    } finally {
      controller.abort();
      await lock.query('ROLLBACK');
      await lock.end();
    }
  });

  test('pool size one clears identity after commit, rollback, expiry, cancellation and disconnect', async () => {
    const url = process.env.API_DATABASE_URL;
    if (!admin || !url) throw new Error('Database configuration is required');
    const pool = createPool(url, 1);
    const credentials = await admin.query<{ token: string; user_id: string }>(
      'SELECT DISTINCT ON (user_id) token,user_id FROM auth.session WHERE expires_at > now() ORDER BY user_id,created_at DESC',
    );
    if (credentials.rows.length !== 2)
      throw new Error('Two live owner credentials are required');
    async function anonymous() {
      await transaction(pool, new AbortController().signal, async (client) => {
        expect(
          (await client.query<{ role: string }>('SELECT current_user AS role'))
            .rows[0]?.role,
        ).toBe('sprout_api');
        await client.query('SET LOCAL ROLE sprout_web');
        expect(
          (await client.query('SELECT * FROM private.owner_settings')).rowCount,
        ).toBe(0);
      });
    }
    try {
      for (const credential of credentials.rows) {
        await transaction(
          pool,
          new AbortController().signal,
          async (client) => {
            await client.query('SET LOCAL ROLE sprout_web');
            await client.query(
              "SELECT set_config('sprout.session_token',$1,true)",
              [credential.token],
            );
            expect(
              (
                await client.query<{ owner_user_id: string }>(
                  'SELECT owner_user_id FROM private.owner_settings',
                )
              ).rows.map((row) => row.owner_user_id),
            ).toEqual([credential.user_id]);
          },
        );
        await anonymous();
        await expect(
          transaction(pool, new AbortController().signal, async (client) => {
            await client.query('SET LOCAL ROLE sprout_web');
            await client.query(
              "SELECT set_config('sprout.session_token',$1,true)",
              [credential.token],
            );
            throw new Error('Synthetic rollback');
          }),
        ).rejects.toThrow('Synthetic rollback');
        await anonymous();
      }
      const expired = credentials.rows[0];
      if (!expired) throw new Error('A test credential is required');
      await admin.query(
        "UPDATE auth.session SET expires_at=now()-interval '1 second' WHERE token=$1",
        [expired.token],
      );
      await transaction(pool, new AbortController().signal, async (client) => {
        await client.query('SET LOCAL ROLE sprout_web');
        await client.query(
          "SELECT set_config('sprout.session_token',$1,true)",
          [expired.token],
        );
        expect(
          (await client.query('SELECT * FROM private.owner_settings')).rowCount,
        ).toBe(0);
      });
      await anonymous();
      await expect(
        transaction(pool, new AbortController().signal, (client) =>
          client.query('SELECT pg_sleep(3)'),
        ),
      ).rejects.toMatchObject({ code: '57014' });
      await anonymous();
      const controller = new AbortController();
      await expect(
        transaction(pool, controller.signal, async (client) => {
          const running = client.query('SELECT pg_sleep(3)');
          controller.abort();
          await running;
        }),
      ).rejects.toThrow();
      await anonymous();
      await expect(
        transaction(pool, new AbortController().signal, async (client) => {
          client.on('error', () => undefined);
          const result = await client.query<{ pid: number }>(
            'SELECT pg_backend_pid() AS pid',
          );
          await admin?.query('SELECT pg_terminate_backend($1)', [
            result.rows[0]?.pid,
          ]);
          await client.query('SELECT 1');
        }),
      ).rejects.toThrow();
      await anonymous();
      let destroyed = false;
      await expect(
        transaction(pool, new AbortController().signal, async (client) => {
          const originalRelease = client.release.bind(client);
          client.release = (destroy) => {
            destroyed = destroy === true;
            originalRelease(destroy);
          };
          vi.spyOn(client, 'query').mockImplementationOnce(() => {
            throw new Error('Synthetic cleanup failure');
          });
          throw new Error('Synthetic operation failure');
        }),
      ).rejects.toThrow('Synthetic operation failure');
      expect(destroyed).toBe(true);
      await anonymous();
    } finally {
      await pool.end();
    }
  }, 30000);

  test('database connection loss yields unavailable and recovers without false logout success', async () => {
    if (!admin) throw new Error('Database configuration is required');
    const cookie = await signedIn();
    await admin.query('ALTER ROLE sprout_auth NOLOGIN');
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='sprout_auth' AND pid<>pg_backend_pid()",
    );
    try {
      expect((await api('/api/session', { headers: { cookie } })).status).toBe(
        503,
      );
      const logout = await api('/api/auth/sign-out', {
        method: 'POST',
        headers: authHeaders(cookie),
        body: '{}',
      });
      expect(logout.status).toBe(503);
      expect(logout.headers.getSetCookie()).toEqual([]);
      expect((await signIn()).status).toBe(503);
    } finally {
      await admin.query('ALTER ROLE sprout_auth LOGIN');
    }
    expect((await api('/api/shell', { headers: { cookie } })).status).toBe(200);
  });

  test('sign-in is rate limited after repeated attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 22; attempt++) {
      const response = await signIn(owner.email, 'wrong-password');
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
    expect(statuses.every((status) => status === 401 || status === 429)).toBe(
      true,
    );
  }, 30000);
});
