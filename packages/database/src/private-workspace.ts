import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { DatabaseSettings } from './index.js';

export class PrivateAccessDenied extends Error {}

/** Every call revalidates a real session inside the same RLS transaction. */
export const createWorkspaceStore = (settings: DatabaseSettings) => {
  const pool = new Pool({
    connectionString: settings.url,
    max: settings.maxConnections,
    connectionTimeoutMillis: 1500,
    statement_timeout: 1500,
  });
  pool.on('error', () => console.error('Private database connection lost'));
  return {
    close: () => pool.end(),
    read: async (sessionToken: string, requestedOwner: string) => {
      const client = await pool.connect();
      let destroy = false;
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE sprout_private');
        await client.query(
          "SELECT set_config('sprout.session_token', $1, true)",
          [sessionToken],
        );
        const identity = await client.query<{ owner: string | null }>(
          'SELECT public.private_session_owner() AS owner',
        );
        if (!identity.rows[0]?.owner) throw new PrivateAccessDenied();
        const result = await readWorkspace(client, requestedOwner);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          destroy = true;
        }
        throw error;
      } finally {
        client.release(destroy);
      }
    },
  };
};

const readWorkspace = async (client: PoolClient, owner: string) => {
  const result = await client.query<{ ownerId: string }>(
    'SELECT "ownerId" FROM workspace WHERE "ownerId" = $1',
    [owner],
  );
  return result.rows[0];
};
