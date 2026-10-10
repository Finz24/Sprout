import { resolve } from 'node:path';
import { Context, Data, Effect, Layer } from 'effect';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Pool } from 'pg';

export type DatabaseFailure = 'connection' | 'migrations' | 'pgvector';
export class DatabaseUnavailable extends Data.TaggedError(
  'DatabaseUnavailable',
)<{ readonly reason: DatabaseFailure }> {}
export interface DatabaseSettings {
  readonly url: string;
  readonly maxConnections: number;
  readonly migrationsFolder: string;
}
export const migrationsFolder = () =>
  resolve(process.env.MIGRATIONS_DIR ?? 'packages/database/migrations');
export class Database extends Context.Service<
  Database,
  { readonly probe: Effect.Effect<void, DatabaseUnavailable> }
>()('Sprout/Database') {}

export const DatabaseLive = (settings: DatabaseSettings) =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      const migrations = yield* Effect.try({
        try: () =>
          readMigrationFiles({ migrationsFolder: settings.migrationsFolder }),
        catch: () => new DatabaseUnavailable({ reason: 'migrations' }),
      });
      const expectedHash = migrations.at(-1)?.hash;
      if (!expectedHash)
        return yield* Effect.fail(
          new DatabaseUnavailable({ reason: 'migrations' }),
        );
      const pool = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new Pool({
              connectionString: settings.url,
              max: settings.maxConnections,
              idleTimeoutMillis: 10000,
              connectionTimeoutMillis: 1500,
              statement_timeout: 1500,
              query_timeout: 1800,
            }),
        ),
        (pool) =>
          Effect.promise(() => pool.end()).pipe(
            Effect.catchCause(() => Effect.void),
          ),
      );
      pool.on('error', () => console.error('Database idle connection lost'));
      const probe = Effect.tryPromise({
        try: async () => {
          await pool.query('SELECT 1');
          let hash: string | undefined;
          try {
            const result = await pool.query<{ hash: string }>(
              'SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1',
            );
            hash = result.rows[0]?.hash;
          } catch {
            throw new DatabaseUnavailable({ reason: 'migrations' });
          }
          if (hash !== expectedHash)
            throw new DatabaseUnavailable({ reason: 'migrations' });
          const result = await pool.query<{ installed: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed",
          );
          if (!result.rows[0]?.installed)
            throw new DatabaseUnavailable({ reason: 'pgvector' });
        },
        catch: (error) =>
          error instanceof DatabaseUnavailable
            ? error
            : new DatabaseUnavailable({ reason: 'connection' }),
      });
      return { probe };
    }),
  );
