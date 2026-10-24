import { createServer } from 'node:http';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';
import { NodeHttpServer } from '@effect/platform-node';
import { HealthApi } from '@sprout/contracts';
import type { ComponentName } from '@sprout/contracts';
import { AccessHttp, DatabaseLive, IdentityLive } from '@sprout/database';
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
const privateRoutes = HttpRouter.add('*', '/api/*', (request) =>
  Effect.gen(function* () {
    const access = yield* AccessHttp;
    const signal = yield* Effect.abortSignal;
    const web = yield* HttpServerRequest.toWeb(request, { signal });
    return HttpServerResponse.fromWeb(yield* access.handle(web));
  }).pipe(
    Effect.scoped,
    Effect.catchCause(() =>
      Effect.succeed(
        HttpServerResponse.text('Service unavailable', {
          status: 503,
          headers: { 'cache-control': 'no-store' },
        }),
      ),
    ),
  ),
);
export const serverLayer = (settings: Settings) =>
  HttpRouter.serve(
    settings.component === 'api' && settings.identity
      ? Layer.merge(
          healthRoutes(settings.component),
          privateRoutes.pipe(
            HttpRouter.provideRequest(IdentityLive(settings.identity)),
          ),
        )
      : healthRoutes(settings.component),
    {
      disableLogger: true,
    },
  ).pipe(
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
