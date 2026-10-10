import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import {
  Database,
  DatabaseUnavailable,
  type DatabaseFailure,
} from '@sprout/database';
import { readiness, loadSettings } from '@sprout/runtime';

describe('component health contract', () => {
  it('requires the initialized dependencies before reporting worker readiness', async () => {
    const result = await Effect.runPromise(
      readiness('worker').pipe(
        Effect.provideService(Database, { probe: Effect.void }),
      ),
    );
    expect(result).toEqual({
      status: 'ready',
      component: 'worker',
      dependencies: {
        postgres: 'ready',
        migrations: 'ready',
        pgvector: 'ready',
      },
    });
  });
  it.each([
    [
      'connection',
      {
        postgres: 'unavailable',
        migrations: 'not_checked',
        pgvector: 'not_checked',
      },
    ],
    [
      'migrations',
      { postgres: 'ready', migrations: 'missing', pgvector: 'not_checked' },
    ],
    [
      'pgvector',
      { postgres: 'ready', migrations: 'ready', pgvector: 'missing' },
    ],
  ] as const)(
    'reports %s failures without pretending later probes passed',
    async (reason: DatabaseFailure, expected) => {
      const result = await Effect.runPromise(
        readiness('api').pipe(
          Effect.provideService(Database, {
            probe: Effect.fail(new DatabaseUnavailable({ reason })),
          }),
          Effect.catch((failure) => Effect.succeed(failure)),
        ),
      );
      expect(result).toEqual({
        status: 'not_ready',
        component: 'api',
        dependencies: expected,
      });
    },
  );
});

describe('startup configuration', () => {
  it('separates default ports and keeps the idle worker pool small', () => {
    expect(loadSettings('api', {}).port).toBe(3001);
    expect(loadSettings('worker', {}).port).toBe(3002);
    expect(loadSettings('worker', {}).database.maxConnections).toBe(3);
  });
  it.each(['0', '65536', 'NaN', '2.5'])(
    'rejects invalid listener port %s',
    (PORT) => {
      expect(() => loadSettings('api', { PORT })).toThrow();
    },
  );
  it('does not disclose supplied connection credentials in configuration errors', () => {
    try {
      loadSettings('api', {
        DATABASE_URL: 'https://private.invalid/placeholder',
      });
      throw new Error('Expected configuration rejection');
    } catch (error) {
      expect(error).toMatchObject({
        _tag: 'ConfigurationError',
        setting: 'DATABASE_URL',
      });
      expect(String(error)).not.toContain('private.invalid');
    }
  });
});
