import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createOwner } from '../../packages/database/src/bootstrap.js';
import { provisionSyntheticOwner } from '../../packages/database/src/test-fixtures.js';

const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3001';
const origin = process.env.SPROUT_ORIGIN ?? process.env.WEB_URL ?? 'http://127.0.0.1:5173';
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
const admin = adminUrl ? new Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 }) : undefined;

const json = async (response: Response): Promise<unknown> => { const body: unknown = JSON.parse(await response.text()); return body; };
const cookieHeader = (response: Response) =>
  response.headers.getSetCookie().map((value) => value.split(';')[0] ?? '').filter(Boolean).join('; ');
const api = (path: string, init: RequestInit = {}) => fetch(`${apiUrl}${path}`, { ...init, signal: AbortSignal.timeout(10000) });
const authHeaders = (cookie: string) => ({ cookie, origin, 'content-type': 'application/json' });
const signIn = (email = owner.email, password = owner.password, requestOrigin = origin) =>
  api('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
async function signedIn(email = owner.email, password = owner.password) {
  const response = await signIn(email, password);
  expect(response.status).toBe(200);
  const cookie = cookieHeader(response);
  expect(cookie).toContain('sprout.session_token=');
  return cookie;
}
async function count(table: string) {
  if (!admin) throw new Error('DATABASE_URL is required');
  const result = await admin.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
  return Number(result.rows[0]?.count);
}
const withApplicationName = (url: string, name: string) => {
  const parsed = new URL(url);
  parsed.searchParams.set('application_name', name);
  return parsed.toString();
};

beforeAll(async () => {
  if (!adminUrl || !maintenanceUrl) throw new Error('DATABASE_URL and MAINTENANCE_DATABASE_URL are required');
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
    if (!admin || !maintenanceUrl) throw new Error('Database configuration is required');
    const interruptedUrl = withApplicationName(maintenanceUrl, 'sprout-bootstrap-interrupt');
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
      const pending = createOwner(interruptedUrl, owner).catch((error: unknown) => error);
      let terminated = false;
      for (let attempt = 0; attempt < 40 && !terminated; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const rows = await admin.query<{ pid: number }>(
          "SELECT pid FROM pg_stat_activity WHERE application_name = 'sprout-bootstrap-interrupt' AND state = 'active'",
        );
        for (const row of rows.rows) {
          const result = await admin.query<{ terminated: boolean }>('SELECT pg_terminate_backend($1) AS terminated', [row.pid]);
          if (result.rows[0]?.terminated) terminated = true;
        }
      }
      expect(terminated).toBe(true);
      expect(await pending).toBeInstanceOf(Error);
      expect(await count('auth."user"')).toBe(0);
      expect(await count('private.owner_settings')).toBe(0);
    } finally {
      await admin.query('DROP TRIGGER IF EXISTS slow_owner_insert ON private.owner_settings');
      await admin.query('DROP FUNCTION IF EXISTS private.slow_owner_insert()');
    }
  }, 30000);

  test('a bootstrap race creates exactly one complete owner', async () => {
    if (!maintenanceUrl) throw new Error('MAINTENANCE_DATABASE_URL is required');
    const results = await Promise.all([createOwner(maintenanceUrl, owner), createOwner(maintenanceUrl, owner)]);
    expect(results.sort()).toEqual(['AlreadyProvisioned', 'Created']);
    expect(await count('auth."user"')).toBe(1);
    expect(await count('auth.account')).toBe(1);
    expect(await count('private.owner_settings')).toBe(1);
    expect(await createOwner(maintenanceUrl, owner)).toBe('AlreadyProvisioned');
  }, 30000);

  test('an inconsistent installation cannot gain another owner', async () => {
    if (!admin || !maintenanceUrl) throw new Error('Database configuration is required');
    const extraId = randomUUID();
    await admin.query('INSERT INTO auth."user" (id, name, email) VALUES ($1, $2, $3)', [
      extraId,
      'Incomplete',
      'incomplete@example.invalid',
    ]);
    try {
      expect(await createOwner(maintenanceUrl, owner)).toBe('InconsistentInstallation');
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
    const sessionCookie = setCookies.find((value) => value.startsWith('sprout.session_token='));
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
    expect(sessionBody).toMatchObject({ kind: 'Authenticated', owner: { name: owner.name, email: owner.email } });
    expect(sessionBody).toHaveProperty('expiresAt', expect.any(String));
    const shell = await api('/api/shell', { headers: { cookie } });
    expect(shell.status).toBe(200);
    const body = await json(shell);
    expect(body).toEqual({ owner: { name: owner.name, email: owner.email }, libraryView: 'grid' });
    expect(JSON.stringify(body)).not.toContain('token');
    const anonymous = await api('/api/shell');
    expect(anonymous.status).toBe(401);
  });

  test('sign-up is unreachable and unexpected methods or paths are rejected', async () => {
    const before = await count('auth."user"');
    for (const path of ['/api/auth/sign-up/email', '/api/auth/sign-%75p/email', '/api/auth/session']) {
      const response = await api(path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
      expect(response.status).toBe(404);
    }
    const method = await api('/api/auth/sign-out', { headers: { origin } });
    expect(method.status).toBe(404);
    expect(await count('auth."user"')).toBe(before);
  });

  test('origin and JSON content-type checks reject cross-site or form posts', async () => {
    const wrongOrigin = await signIn(owner.email, owner.password, 'http://attacker.invalid');
    expect(wrongOrigin.status).toBe(403);
    const form = await api('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=x&password=y',
    });
    expect(form.status).toBe(403);
  });

  test('two owners see only their own persisted preference', async () => {
    if (!maintenanceUrl) throw new Error('MAINTENANCE_DATABASE_URL is required');
    await provisionSyntheticOwner(maintenanceUrl, other);
    const first = await signedIn();
    const second = await signedIn(other.email, other.password);
    const update = await api('/api/settings/library-view', {
      method: 'PUT',
      headers: authHeaders(second),
      body: JSON.stringify({ libraryView: 'list' }),
    });
    expect(update.status).toBe(200);
    const secondShell = await api('/api/shell', { headers: { cookie: second } });
    const firstShell = await api('/api/shell', { headers: { cookie: first } });
    expect((await json(secondShell))).toMatchObject({ owner: { email: other.email }, libraryView: 'list' });
    expect((await json(firstShell))).toMatchObject({ owner: { email: owner.email }, libraryView: 'grid' });
  });

  test('an expired session cannot read private state', async () => {
    if (!admin) throw new Error('DATABASE_URL is required');
    const cookie = await signedIn();
    await admin.query("UPDATE auth.session SET expires_at = now() - interval '1 second' WHERE user_id = (SELECT id FROM auth.\"user\" WHERE email = $1)", [owner.email]);
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
      const failed = await api('/api/auth/sign-out', { method: 'POST', headers: authHeaders(cookie), body: '{}' });
      expect(failed.status).toBe(503);
      expect(await count('auth.session')).toBeGreaterThan(0);
      const stillPrivate = await api('/api/shell', { headers: { cookie } });
      expect(stillPrivate.status).toBe(200);
    } finally {
      await admin.query('GRANT DELETE ON auth.session TO sprout_auth');
    }
    const revoked = await api('/api/auth/sign-out', { method: 'POST', headers: authHeaders(cookie), body: '{}' });
    expect(revoked.status).toBe(200);
    expect(revoked.headers.getSetCookie().some((value) => value.startsWith('sprout.session_token=') && value.includes('Max-Age=0'))).toBe(true);
    const replay = await api('/api/shell', { headers: { cookie } });
    expect(replay.status).toBe(401);
    expect(await count('auth.session')).toBe(sessionsBefore - 1);
  });

  test('sign-in is rate limited after repeated attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 22; attempt++) {
      const response = await signIn(owner.email, 'wrong-password');
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
    expect(statuses.every((status) => status === 401 || status === 429)).toBe(true);
  }, 30000);
});
