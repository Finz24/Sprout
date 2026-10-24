import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { hashPassword } from 'better-auth/crypto';
import { Schema } from 'effect';
import { createPool, transaction } from './private-storage.js';

const ProvisionInput = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
  email: Schema.String.check(
    Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    Schema.isMaxLength(254),
  ),
  password: Schema.String.check(
    Schema.isMinLength(12),
    Schema.isMaxLength(128),
  ),
});
export type ProvisionInput = typeof ProvisionInput.Type;
export type BootstrapResult =
  'Created' | 'AlreadyProvisioned' | 'InconsistentInstallation';

export async function createOwner(
  url: string,
  input: ProvisionInput,
  signal: AbortSignal = new AbortController().signal,
): Promise<BootstrapResult> {
  const parsed = Schema.decodeUnknownSync(ProvisionInput)({
    ...input,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
  });
  const passwordHash = await hashPassword(parsed.password);
  const pool = createPool(url, 1);
  try {
    return await transaction(pool, signal, async (client) => {
      const identity = await client.query<{ allowed: boolean }>(
        "SELECT current_user = 'sprout_maintenance' AS allowed",
      );
      if (!identity.rows[0]?.allowed)
        throw new Error('Maintenance login required');
      await client.query('SELECT pg_advisory_xact_lock(1085934216)');
      const state = await client.query<{ empty: boolean; complete: boolean }>(`
        SELECT
          (SELECT count(*) FROM auth."user") = 0 AND
          (SELECT count(*) FROM auth.account) = 0 AND
          (SELECT count(*) FROM auth.session) = 0 AND
          (SELECT count(*) FROM auth.verification) = 0 AND
          (SELECT count(*) FROM private.owner_settings) = 0 AS empty,
          (SELECT count(*) FROM auth."user") = 1 AND
          (SELECT count(*) FROM auth.account) = 1 AND
          (SELECT count(*) FROM private.owner_settings) = 1 AND
          NOT EXISTS (SELECT 1 FROM auth.verification) AND
          EXISTS (SELECT 1 FROM auth."user" u JOIN auth.account a ON a.user_id = u.id
            JOIN private.owner_settings s ON s.owner_user_id = u.id
            WHERE a.provider_id = 'credential' AND a.account_id = u.id AND a.password IS NOT NULL) AS complete`);
      if (!state.rows[0]?.empty)
        return state.rows[0]?.complete
          ? 'AlreadyProvisioned'
          : 'InconsistentInstallation';
      const id = randomUUID();
      await client.query(
        'INSERT INTO auth."user" (id, name, email) VALUES ($1, $2, $3)',
        [id, parsed.name, parsed.email],
      );
      await client.query(
        'INSERT INTO auth.account (id, user_id, account_id, provider_id, password) VALUES ($1, $2, $2, $3, $4)',
        [randomUUID(), id, 'credential', passwordHash],
      );
      await client.query(
        'INSERT INTO private.owner_settings (owner_user_id) VALUES ($1)',
        [id],
      );
      return 'Created';
    });
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const url = process.env.MAINTENANCE_DATABASE_URL;
  const name = process.env.SPROUT_OWNER_NAME;
  const email = process.env.SPROUT_OWNER_EMAIL;
  const password = process.env.SPROUT_OWNER_PASSWORD;
  if (!url || !name || !email || !password) {
    console.error(
      'Set MAINTENANCE_DATABASE_URL, SPROUT_OWNER_NAME, SPROUT_OWNER_EMAIL and SPROUT_OWNER_PASSWORD privately.',
    );
    process.exitCode = 1;
  } else {
    await createOwner(url, { name, email, password })
      .then((result) => {
        console.info(result);
        if (result === 'InconsistentInstallation') process.exitCode = 1;
      })
      .catch(() => {
        console.error(
          'Owner provisioning did not complete. Inspect the installation through local maintenance.',
        );
        process.exitCode = 1;
      });
  }
}
