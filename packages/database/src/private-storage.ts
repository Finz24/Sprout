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
    WITH protected_owners AS (
      SELECT c.relowner AS owner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('auth', 'private')
      UNION SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('auth', 'private')
      UNION SELECT nspowner FROM pg_namespace WHERE nspname IN ('auth', 'private')
    )
    SELECT current_user = $1 AND NOT r.rolsuper AND NOT r.rolbypassrls
      AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication
      AND NOT EXISTS (
        SELECT 1 FROM protected_owners WHERE owner = r.oid
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_roles p WHERE pg_has_role(r.oid, p.oid, 'MEMBER')
          AND p.oid <> r.oid AND NOT ($1 = 'sprout_api' AND p.rolname = 'sprout_web')
      ) AND ($1 <> 'sprout_api' OR (NOT r.rolinherit
        AND pg_has_role(r.oid, 'sprout_web', 'SET')
        AND NOT pg_has_role(r.oid, 'sprout_web', 'USAGE')
        AND EXISTS (
          SELECT 1 FROM pg_roles w WHERE w.rolname = 'sprout_web'
            AND NOT w.rolcanlogin AND NOT w.rolsuper AND NOT w.rolbypassrls
            AND NOT w.rolcreatedb AND NOT w.rolcreaterole AND NOT w.rolreplication
            AND NOT EXISTS (SELECT 1 FROM protected_owners WHERE owner = w.oid)
            AND NOT EXISTS (
              SELECT 1 FROM pg_roles p WHERE p.oid <> w.oid AND pg_has_role(w.oid, p.oid, 'MEMBER')
            )
        )))
      AS safe FROM pg_roles r WHERE r.rolname = current_user`,
    [expected],
  );
  if (result.rows[0]?.safe !== true) throw new Unavailable();
  const grants = await pool.query<{ safe: boolean }>(
    `
    WITH protected_tables AS (
      SELECT c.oid, n.nspname, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE (n.nspname = 'auth' AND c.relname IN ('user', 'account', 'session', 'verification'))
        OR (n.nspname = 'private' AND c.relname = 'owner_settings')
    ), resolver AS (
      SELECT p.oid
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'private' AND p.proname = 'current_owner_id'
    )
    SELECT NOT has_schema_privilege(current_user, 'auth', 'CREATE')
      AND NOT has_schema_privilege(current_user, 'private', 'CREATE')
      AND (SELECT count(*) = 5 AND bool_and(NOT has_table_privilege(current_user, c.oid,
        CASE
          WHEN $1 = 'sprout_auth' AND c.nspname = 'auth' AND c.relname IN ('user', 'account')
            THEN 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
          WHEN $1 = 'sprout_auth' AND c.nspname = 'auth' AND c.relname = 'session'
            THEN 'TRUNCATE,REFERENCES,TRIGGER'
          ELSE 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        END))
        FROM protected_tables c)
      AND (SELECT count(*) = 1 AND bool_and(NOT has_function_privilege(current_user, r.oid, 'EXECUTE'))
        FROM resolver r)
      AND ($1 <> 'sprout_api' OR (
        NOT has_schema_privilege('sprout_web', 'auth', 'USAGE,CREATE')
        AND NOT has_schema_privilege('sprout_web', 'private', 'CREATE')
        AND has_schema_privilege('sprout_web', 'private', 'USAGE')
        AND (SELECT count(*) = 5 AND bool_and(
          NOT has_table_privilege('sprout_web', c.oid,
            CASE WHEN c.nspname = 'private' THEN 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
              ELSE 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN' END)
          AND NOT EXISTS (
            SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
              AND has_column_privilege('sprout_web', c.oid, a.attnum,
                CASE WHEN c.nspname = 'auth' THEN 'SELECT,INSERT,UPDATE,REFERENCES'
                  WHEN a.attname IN ('library_view', 'updated_at') THEN 'INSERT,REFERENCES'
                  ELSE 'INSERT,UPDATE,REFERENCES' END)
          )) FROM protected_tables c)
        AND (SELECT has_table_privilege('sprout_web', c.oid, 'SELECT')
          FROM protected_tables c WHERE c.nspname = 'private' AND c.relname = 'owner_settings')
        AND (SELECT count(*) = 2 AND bool_and(has_column_privilege('sprout_web', c.oid, a.attnum, 'UPDATE'))
          FROM protected_tables c JOIN pg_attribute a
            ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          WHERE c.nspname = 'private' AND c.relname = 'owner_settings'
            AND a.attname IN ('library_view', 'updated_at'))
        AND (SELECT count(*) = 1 AND bool_and(has_function_privilege('sprout_web', r.oid, 'EXECUTE'))
          FROM resolver r)
      ))
      AS safe`,
    [expected],
  );
  if (grants.rows[0]?.safe !== true) throw new Unavailable();
  const library = await pool.query<{ safe: boolean }>(`
    WITH saved AS (
      SELECT c.oid, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='private' AND c.relname='saved_item' AND c.relkind='r'
    )
    SELECT count(*) = 1 AND bool_and(
      s.relrowsecurity AND s.relforcerowsecurity
      AND NOT has_table_privilege(current_user,s.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      AND NOT EXISTS (
        SELECT 1 FROM pg_attribute a WHERE a.attrelid=s.oid AND a.attnum>0 AND NOT a.attisdropped
          AND has_column_privilege(current_user,s.oid,a.attnum,'SELECT,INSERT,UPDATE,REFERENCES')
      )
      AND has_table_privilege('sprout_web',s.oid,'SELECT')
      AND NOT has_table_privilege('sprout_web',s.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
      AND (SELECT count(*)=6 AND bool_and(
        has_column_privilege('sprout_web',s.oid,a.attnum,'SELECT')
        AND has_column_privilege('sprout_web',s.oid,a.attnum,'INSERT') =
          (a.attname IN ('id','owner_user_id','submission_id','original_text','submitted_intent'))
        AND NOT has_column_privilege('sprout_web',s.oid,a.attnum,'UPDATE,REFERENCES')
      ) FROM pg_attribute a WHERE a.attrelid=s.oid AND a.attnum>0 AND NOT a.attisdropped)
      AND (SELECT count(*)=2 AND bool_and(
        p.polpermissive AND p.polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='sprout_web')]
        AND CASE p.polcmd
          WHEN 'r' THEN p.polname='saved_item_read' AND p.polwithcheck IS NULL
            AND COALESCE(pg_get_expr(p.polqual,p.polrelid)='(owner_user_id = private.current_owner_id())',false)
          WHEN 'a' THEN p.polname='saved_item_insert' AND p.polqual IS NULL
            AND COALESCE(pg_get_expr(p.polwithcheck,p.polrelid)='(owner_user_id = private.current_owner_id())',false)
          ELSE false END
      ) FROM pg_policy p WHERE p.polrelid=s.oid)
    ) AS safe FROM saved s
  `);
  if (library.rows[0]?.safe !== true) throw new Unavailable();
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
