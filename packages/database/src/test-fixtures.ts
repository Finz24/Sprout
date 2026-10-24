import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { createPool, transaction } from './private-storage.js';
import type { ProvisionInput } from './bootstrap.js';

export async function provisionSyntheticOwner(
  url: string,
  input: ProvisionInput,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  const pool = createPool(url, 1);
  try {
    return await transaction(pool, signal, async (client) => {
      const identity = await client.query<{ allowed: boolean }>(
        "SELECT current_user = 'sprout_maintenance' AS allowed",
      );
      if (!identity.rows[0]?.allowed)
        throw new Error('Maintenance login required');
      await client.query('SELECT pg_advisory_xact_lock(1085934216)');
      const id = randomUUID();
      await client.query(
        'INSERT INTO auth."user" (id, name, email) VALUES ($1, $2, $3)',
        [id, input.name.trim(), input.email.trim().toLowerCase()],
      );
      await client.query(
        'INSERT INTO auth.account (id, user_id, account_id, provider_id, password) VALUES ($1, $2, $2, $3, $4)',
        [randomUUID(), id, 'credential', passwordHash],
      );
      await client.query(
        'INSERT INTO private.owner_settings (owner_user_id) VALUES ($1)',
        [id],
      );
      return id;
    });
  } finally {
    await pool.end();
  }
}
