import { Effect } from 'effect';
import type {
  ComponentName,
  NotReadyResponse,
  ReadyResponse,
} from '@sprout/contracts';
import { Database } from '@sprout/database';

export const readiness = (
  component: ComponentName,
): Effect.Effect<ReadyResponse, NotReadyResponse, Database> =>
  Effect.gen(function* () {
    const database = yield* Database;
    return yield* database.probe.pipe(
      Effect.as({
        status: 'ready' as const,
        component,
        dependencies: {
          postgres: 'ready' as const,
          migrations: 'ready' as const,
          pgvector: 'ready' as const,
        },
      }),
      Effect.catch((error) =>
        Effect.fail({
          status: 'not_ready' as const,
          component,
          dependencies: {
            postgres:
              error.reason === 'connection'
                ? ('unavailable' as const)
                : ('ready' as const),
            migrations:
              error.reason === 'connection'
                ? ('not_checked' as const)
                : error.reason === 'migrations'
                  ? ('missing' as const)
                  : ('ready' as const),
            pgvector:
              error.reason === 'pgvector'
                ? ('missing' as const)
                : ('not_checked' as const),
          },
        }),
      ),
    );
  });
