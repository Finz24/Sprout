import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { bootstrapOwner, loadSettings } from '@sprout/runtime';

export default async function setup() {
  if (!process.env.DATABASE_URL || process.env.SPROUT_TEST_DATABASE !== '1')
    throw new Error('E2E requires an explicit isolated DATABASE_URL');
  const password = randomUUID() + randomUUID();
  process.env.SPROUT_TEST_PASSWORD = password;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const unexpected = await pool.query(
      'SELECT id FROM "user" WHERE email NOT IN ($1, $2) LIMIT 1',
      ['owner@sprout.test', 'other@sprout.test'],
    );
    if (unexpected.rowCount)
      throw new Error('E2E refuses a database containing non-fixture users');
    const existing = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      ['owner@sprout.test'],
    );
    if (!existing.rowCount) {
      await bootstrapOwner(loadSettings('api').database, {
        SPROUT_OWNER_EMAIL: 'owner@sprout.test',
        SPROUT_OWNER_NAME: 'Synthetic owner',
        SPROUT_OWNER_PASSWORD: password,
      });
    } else {
      await pool.query('UPDATE account SET password = $1 WHERE "userId" = $2', [
        await hashPassword(password),
        existing.rows[0]?.id,
      ]);
    }
    const owner = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      ['owner@sprout.test'],
    );
    process.env.SPROUT_TEST_OWNER_ID = owner.rows[0]?.id;
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true) ON CONFLICT (id) DO NOTHING',
      ['other-owner', 'Synthetic second owner', 'other@sprout.test'],
    );
    await pool.query(
      'INSERT INTO account (id, "accountId", "providerId", "userId", password) SELECT $1, $2, $3, $2, password FROM account WHERE "userId" = $4 ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password',
      ['other-account', 'other-owner', 'credential', owner.rows[0]?.id],
    );
    await pool.query(
      'INSERT INTO workspace ("ownerId") VALUES ($1) ON CONFLICT DO NOTHING',
      ['other-owner'],
    );
  } finally {
    await pool.end();
  }
}
