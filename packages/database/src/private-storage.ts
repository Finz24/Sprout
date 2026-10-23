import { Pool, type PoolClient } from 'pg';
import { Context, Data, Effect, Schema } from 'effect';
import { LibraryView, type ShellSummary } from '@sprout/contracts';

const OwnerId = Schema.String.pipe(Schema.brand('OwnerId'));
type OwnerId = typeof OwnerId.Type;
const SessionCredential = Schema.String.pipe(Schema.brand('SessionCredential'));
type SessionCredential = typeof SessionCredential.Type;
export class Unauthenticated extends Data.TaggedError('Unauthenticated') {}
export class Unavailable extends Data.TaggedError('Unavailable') {}
export type AccessFailure = Unauthenticated | Unavailable;

// This tag and its credential never leave the server-only identity/storage boundary.
export class RequestAccess extends Context.Service<
  RequestAccess,
  {
    readonly credential: SessionCredential;
    readonly ownerId: OwnerId;
    readonly owner: ShellSummary['owner'];
    readonly expiresAt: string;
  }
>()('Sprout/RequestAccess') {}
export const requestAccess = (
  token: string,
  id: string,
  owner: ShellSummary['owner'],
  expiresAt: Date,
) => ({
  credential: Schema.decodeUnknownSync(SessionCredential)(token),
  ownerId: Schema.decodeUnknownSync(OwnerId)(id),
  owner,
  expiresAt: expiresAt.toISOString(),
});

export function createPool(url: string, max: number) {
  const pool = new Pool({
    connectionString: url,
    max,
    connectionTimeoutMillis: 1500,
    idleTimeoutMillis: 10000,
    statement_timeout: 1500,
    query_timeout: 2000,
    options: '-c client_connection_check_interval=250',
  });
  pool.on('error', () => undefined);
  return pool;
}

export async function validateRole(
  pool: Pool,
  expected: 'sprout_api' | 'sprout_auth' | 'sprout_worker',
) {
  const result = await pool.query<{ safe: boolean }>(
    `
    SELECT current_user = $1 AND NOT r.rolsuper AND NOT r.rolbypassrls
      AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication
      AND NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('auth', 'private') AND c.relowner = r.oid
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_roles p WHERE pg_has_role(r.oid, p.oid, 'MEMBER')
          AND p.oid <> r.oid AND NOT ($1 = 'sprout_api' AND p.rolname = 'sprout_web')
      ) AND ($1 <> 'sprout_api' OR (NOT r.rolinherit
        AND pg_has_role(r.oid, 'sprout_web', 'SET')
        AND NOT pg_has_role(r.oid, 'sprout_web', 'USAGE')))
      AS safe FROM pg_roles r WHERE r.rolname = current_user`,
    [expected],
  );
  if (result.rows[0]?.safe !== true) throw new Unavailable();
  const grants = await pool.query<{ safe: boolean }>(
    `
    SELECT NOT has_schema_privilege(current_user, 'auth', 'CREATE')
      AND NOT has_schema_privilege(current_user, 'private', 'CREATE')
      AND (SELECT count(*) = 5 AND bool_and(NOT has_table_privilege(current_user, c.oid,
        CASE
          WHEN $1 = 'sprout_auth' AND n.nspname = 'auth' AND c.relname IN ('user', 'account')
            THEN 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          WHEN $1 = 'sprout_auth' AND n.nspname = 'auth' AND c.relname = 'session'
            THEN 'TRUNCATE,REFERENCES,TRIGGER'
          ELSE 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        END))
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE (n.nspname = 'auth' AND c.relname IN ('user', 'account', 'session', 'verification'))
          OR (n.nspname = 'private' AND c.relname = 'owner_settings'))
      AND (SELECT count(*) = 1 AND bool_and(NOT has_function_privilege(current_user, p.oid, 'EXECUTE'))
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'private' AND p.proname = 'current_owner_id')
      AS safe`,
    [expected],
  );
  if (grants.rows[0]?.safe !== true) throw new Unavailable();
}

const connectionLost = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: unknown }).code;
  return (
    code === '57014' ||
    code === '57P01' ||
    code === '08006' ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    error.message === 'Query read timeout' ||
    error.message.startsWith('Connection terminated')
  );
};

export async function transaction<A>(
  pool: Pool,
  signal: AbortSignal,
  operation: (client: PoolClient) => Promise<A>,
): Promise<A> {
  const client = await pool.connect();
  let destroyed = false;
  let committing = false;
  let active: Promise<unknown> | undefined;
  const destroy = () => {
    if (!destroyed) {
      destroyed = true;
      client.release(true);
    }
  };
  const onAbort = () => destroy();
  const run = <T>(query: () => Promise<T>) => {
    const pending = query();
    active = pending;
    return pending;
  };
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    signal.throwIfAborted();
    await run(() => client.query('BEGIN ISOLATION LEVEL READ COMMITTED'));
    const value = await run(() => operation(client));
    signal.throwIfAborted();
    committing = true;
    await run(() => client.query('COMMIT'));
    committing = false;
    return value;
  } catch (error) {
    if (committing || connectionLost(error)) destroy();
    if (!destroyed) {
      try {
        await run(() => client.query('ROLLBACK'));
      } catch {
        destroy();
      }
    }
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
    if (active) await active.catch(() => undefined);
    if (!destroyed) client.release();
  }
}

const toFailure = (error: unknown): AccessFailure =>
  error instanceof Unauthenticated ? error : new Unavailable();
export function privateOperation<A>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<A>,
) {
  return Effect.gen(function* () {
    const access = yield* RequestAccess;
    return yield* Effect.tryPromise({
      try: (signal) =>
        transaction(pool, signal, async (client) => {
          await client.query('SET LOCAL ROLE sprout_web');
          await client.query(
            "SELECT set_config('sprout.session_token', $1, true)",
            [access.credential],
          );
          const result = await client.query<{ owner: string | null }>(
            'SELECT private.current_owner_id() AS owner',
          );
          if (result.rows[0]?.owner !== access.ownerId)
            throw new Unauthenticated();
          return operation(client);
        }),
      catch: toFailure,
    });
  });
}

export const shellOperations = (pool: Pool) => ({
  read: () =>
    Effect.gen(function* () {
      const { owner } = yield* RequestAccess;
      const libraryView = yield* privateOperation(pool, async (client) => {
        const result = await client.query<{ library_view: unknown }>(
          'SELECT library_view FROM private.owner_settings',
        );
        if (result.rows.length !== 1) throw new Unavailable();
        return Schema.decodeUnknownSync(LibraryView)(
          result.rows[0]?.library_view,
        );
      });
      return { owner, libraryView };
    }),
  setLibraryView: (view: LibraryView) =>
    privateOperation(pool, async (client) => {
      const result = await client.query(
        'UPDATE private.owner_settings SET library_view = $1, updated_at = statement_timestamp()',
        [view],
      );
      if (result.rowCount !== 1) throw new Unavailable();
    }),
});
