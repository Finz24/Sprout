import { createServer } from 'node:http';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { HttpRouter } from 'effect/http';
import { NodeHttpServer } from '@effect/platform-node';
import { HealthApi } from '@sprout/contracts';
import type { ComponentName } from '@sprout/contracts';
import { DatabaseLive } from '@sprout/database';
import { loadSettings, type Settings } from './config.js';
import { readiness } from './health.js';

export { loadSettings, ConfigurationError } from './config.js';
export { readiness } from './health.js';
export const HealthHandlers = (component: ComponentName) =>
  HttpApiBuilder.group(HealthApi, 'health', (handlers) =>
    handlers
      .handle('live', () =>
        Effect.succeed({ status: 'live' as const, component }),
      )
      .handle('ready', () => readiness(component)),
  );
export const healthRoutes = (component: ComponentName) =>
  HttpApiBuilder.layer(HealthApi).pipe(
    Layer.provide(HealthHandlers(component)),
  );
export const serverLayer = (settings: Settings) =>
  HttpRouter.serve(healthRoutes(settings.component), {
    disableLogger: true,
  }).pipe(
    Layer.provide(DatabaseLive(settings.database)),
    Layer.provide(
      NodeHttpServer.layer(createServer, {
        host: settings.hostname,
        port: settings.port,
        gracefulShutdownTimeout: '5 seconds',
      }),
    ),
  );
export const runComponent = (component: ComponentName) =>
  Effect.gen(function* () {
    const settings = yield* Effect.try({
      try: () => loadSettings(component),
      catch: () =>
        new Error(
          'Invalid runtime configuration; check PORT, DATABASE_POOL_SIZE and DATABASE_URL',
        ),
    });
    yield* Layer.launch(serverLayer(settings));
  });
