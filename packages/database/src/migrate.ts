import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Data, Effect } from 'effect';
import { migrationsFolder } from './index.js';

class MigrationFailure extends Data.TaggedError('MigrationFailure') {}
const program = Effect.gen(function* () {
  const client = yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const client = new Client({
          connectionString:
            process.env.DATABASE_URL ??
            'postgresql://sprout@127.0.0.1:54329/sprout',
          connectionTimeoutMillis: 5000,
          statement_timeout: 30000,
        });
        try {
          await client.connect();
          return client;
        } catch (error) {
          await client.end().catch(() => undefined);
          throw error;
        }
      },
      catch: () => new MigrationFailure(),
    }),
    (client) =>
      Effect.promise(() => client.end()).pipe(
        Effect.catchCause(() => Effect.void),
      ),
  );
  yield* Effect.acquireRelease(
    Effect.tryPromise({
      try: () => client.query('SELECT pg_advisory_lock(1085934215)'),
      catch: () => new MigrationFailure(),
    }),
    () =>
      Effect.promise(() =>
        client.query('SELECT pg_advisory_unlock(1085934215)'),
      ).pipe(Effect.catchCause(() => Effect.void)),
  );
  yield* Effect.tryPromise({
    try: () =>
      migrate(drizzle(client), { migrationsFolder: migrationsFolder() }),
    catch: () => new MigrationFailure(),
  });
  console.info('Committed migrations applied');
});
await Effect.runPromise(Effect.scoped(program)).catch(() => {
  console.error(
    'Migrations did not complete. Check database connectivity and committed migration files.',
  );
  process.exitCode = 1;
});
