import { Context, Data, Effect, Layer } from 'effect';
import { HttpEffect, HttpRouter } from 'effect/http';
import { Pool } from 'pg';
import { createWorkspaceStore, PrivateAccessDenied } from '@sprout/database';
import type { WorkspaceResponse } from '@sprout/contracts';
import { createAuthentication } from './auth.js';
import type { Settings } from './config.js';

export class WorkspaceFailure extends Data.TaggedError('WorkspaceFailure')<{
  readonly reason: 'unauthenticated' | 'not_found' | 'unavailable';
}> {}

export class WorkspaceAccess extends Context.Service<
  WorkspaceAccess,
  {
    readonly read: (
      headers: Headers,
      owner?: string,
    ) => Effect.Effect<WorkspaceResponse, WorkspaceFailure>;
    readonly authenticate: (request: Request) => Promise<Response>;
  }
>()('Sprout/WorkspaceAccess') {}

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

export const WorkspaceAccessLive = (settings: Settings) =>
  Layer.effect(
    WorkspaceAccess,
    Effect.gen(function* () {
      const pool = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new Pool({
              connectionString: settings.database.url,
              max: settings.database.maxConnections,
              connectionTimeoutMillis: 1500,
            }),
        ),
        (pool) => Effect.promise(() => pool.end()),
      );
      pool.on('error', () =>
        console.error('Authentication database connection lost'),
      );
      const auth = yield* Effect.try({
        try: () => createAuthentication(pool),
        catch: () => new Error('Invalid authentication configuration'),
      });
      yield* Effect.tryPromise({
        try: () => auth.$context,
        catch: () => new Error('Authentication initialization failed'),
      });
      const store = yield* Effect.acquireRelease(
        Effect.sync(() => createWorkspaceStore(settings.database)),
        (store) => Effect.promise(() => store.close()),
      );
      return {
        authenticate: async (request) => {
          try {
            return await auth.handler(request);
          } catch {
            return json({ error: 'Authentication unavailable' }, 503);
          }
        },
        read: (headers, owner) =>
          Effect.gen(function* () {
            const session = yield* Effect.tryPromise({
              try: () => auth.api.getSession({ headers }),
              catch: () => new WorkspaceFailure({ reason: 'unavailable' }),
            });
            if (!session)
              return yield* Effect.fail(
                new WorkspaceFailure({ reason: 'unauthenticated' }),
              );
            const workspace = yield* Effect.tryPromise({
              try: () =>
                store.read(session.session.token, owner ?? session.user.id),
              catch: (error) =>
                new WorkspaceFailure({
                  reason:
                    error instanceof PrivateAccessDenied
                      ? 'unauthenticated'
                      : 'unavailable',
                }),
            });
            if (!workspace)
              return yield* Effect.fail(
                new WorkspaceFailure({ reason: 'not_found' }),
              );
            return {
              owner: { id: workspace.ownerId, name: session.user.name },
              expiresAt: session.session.expiresAt.toISOString(),
              items: [],
            } satisfies WorkspaceResponse;
          }),
      };
    }),
  );

const workspaceResponse = (
  operation: Effect.Effect<WorkspaceResponse, WorkspaceFailure>,
) =>
  Effect.runPromise(
    operation.pipe(
      Effect.match({
        onSuccess: (body) => json(body),
        onFailure: ({ reason }) =>
          reason === 'unauthenticated'
            ? json({ error: 'Sign in required' }, 401)
            : json(
                { error: 'Workspace unavailable' },
                reason === 'not_found' ? 404 : 503,
              ),
      }),
    ),
  );

export const privateRoutes = Layer.mergeAll(
  HttpRouter.add(
    '*',
    '/auth/*',
    Effect.gen(function* () {
      const access = yield* WorkspaceAccess;
      return yield* HttpEffect.fromWebHandler(access.authenticate);
    }),
  ),
  HttpRouter.add(
    'GET',
    '/private/workspace',
    Effect.gen(function* () {
      const access = yield* WorkspaceAccess;
      return yield* HttpEffect.fromWebHandler((request) =>
        workspaceResponse(access.read(request.headers)),
      );
    }),
  ),
  HttpRouter.add(
    'GET',
    '/private/workspaces/:owner',
    Effect.gen(function* () {
      const access = yield* WorkspaceAccess;
      return yield* HttpEffect.fromWebHandler((request) =>
        workspaceResponse(
          access.read(
            request.headers,
            decodeURIComponent(
              new URL(request.url).pathname.split('/').at(-1) ?? '',
            ),
          ),
        ),
      );
    }),
  ),
);
