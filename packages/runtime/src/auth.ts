import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { Settings } from './config.js';

export const createAuthentication = (
  pool: Pool,
  env: NodeJS.ProcessEnv = process.env,
) => {
  const secret = env.BETTER_AUTH_SECRET;
  const baseURL = env.AUTH_ORIGIN ?? 'http://127.0.0.1:5173';
  if (!secret || secret.length < 32)
    throw new Error(
      'BETTER_AUTH_SECRET must be supplied and contain at least 32 characters',
    );
  const origin = new URL(baseURL);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== baseURL
  )
    throw new Error('AUTH_ORIGIN must be an exact HTTP origin');
  const expiresIn = Number(env.SESSION_TTL_SECONDS ?? 86400);
  if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 604800)
    throw new Error('Invalid SESSION_TTL_SECONDS');
  return betterAuth({
    database: pool,
    secret,
    baseURL,
    basePath: '/auth',
    trustedOrigins: [baseURL],
    emailAndPassword: { enabled: true, disableSignUp: true },
    session: {
      expiresIn,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: { useSecureCookies: origin.protocol === 'https:' },
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
};

/** Local provisioning only; refuses a populated installation under a DB lock. */
export async function bootstrapOwner(
  settings: Settings['database'],
  env: NodeJS.ProcessEnv = process.env,
) {
  const email = env.SPROUT_OWNER_EMAIL?.trim().toLowerCase();
  const password = env.SPROUT_OWNER_PASSWORD;
  const name = env.SPROUT_OWNER_NAME?.trim();
  if (
    !email ||
    !email.includes('@') ||
    !name ||
    !password ||
    password.length < 12
  )
    throw new Error(
      'Supply SPROUT_OWNER_EMAIL, SPROUT_OWNER_NAME and SPROUT_OWNER_PASSWORD (12+ characters) through the environment',
    );
  const hash = await hashPassword(password);
  const pool = new Pool({
    connectionString: settings.url,
    max: 1,
    connectionTimeoutMillis: 1500,
  });
  let client: PoolClient | undefined;
  let destroy = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(1085934216)');
    const existing = await client.query('SELECT id FROM "user" LIMIT 1');
    if (existing.rowCount) throw new Error('Owner already provisioned');
    const id = randomUUID();
    await client.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)',
      [id, name, email],
    );
    await client.query(
      'INSERT INTO account (id, "accountId", "providerId", "userId", password) VALUES ($1, $2, $3, $2, $4)',
      [randomUUID(), id, 'credential', hash],
    );
    await client.query('INSERT INTO workspace ("ownerId") VALUES ($1)', [id]);
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client?.query('ROLLBACK');
    } catch {
      destroy = true;
    }
    throw error;
  } finally {
    client?.release(destroy);
    await pool.end();
  }
}
