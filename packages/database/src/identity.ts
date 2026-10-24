import { Context, Data, Effect, Layer, Schema } from 'effect';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';
import { drizzle } from 'drizzle-orm/node-postgres';
import { SetLibraryView, type Access } from '@sprout/contracts';
import * as schema from './schema.js';
import {
  createPool,
  requestAccess,
  RequestAccess,
  shellOperations,
  Unauthenticated,
  Unavailable,
  validateRole,
} from './private-storage.js';

export interface IdentitySettings {
  readonly authUrl: string;
  readonly privateUrl: string;
  readonly origin: string;
  readonly secret: string;
  readonly loopbackDevelopment: boolean;
  readonly maxConnections: number;
}
const json = (body: unknown, status = 200, cookies: readonly string[] = []) => {
  const headers = new Headers({
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
};
export class AccessHttp extends Context.Service<
  AccessHttp,
  {
    readonly handle: (request: Request) => Effect.Effect<Response>;
  }
>()('Sprout/AccessHttp') {}
class PayloadTooLarge extends Data.TaggedError('PayloadTooLarge') {}
const maxBodyBytes = 16 * 1024;
async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Unauthenticated();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed;
  } catch {
    throw new Unauthenticated();
  }
}

export const createIdentityAuth = (
  settings: IdentitySettings,
  authPool: ReturnType<typeof createPool>,
) =>
  betterAuth({
    database: drizzleAdapter(drizzle(authPool), { provider: 'pg', schema }),
    baseURL: settings.origin,
    basePath: '/api/auth',
    secret: settings.secret,
    trustedOrigins: [settings.origin],
    emailAndPassword: { enabled: true, disableSignUp: true },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: new URL(settings.origin).protocol === 'https:',
      cookiePrefix: 'sprout',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: [] },
    },
    rateLimit: {
      enabled: true,
      storage: 'memory',
      window: 60,
      max: 100,
      customRules: { '/sign-in/email': { window: 60, max: 20 } },
    },
    logger: { disabled: true },
    onAPIError: { throw: true },
    databaseHooks: {
      user: {
        create: {
          before: () => {
            throw new APIError('FORBIDDEN', {
              message: 'Provisioning is local only',
            });
          },
        },
      },
    },
    plugins: [
      {
        id: 'durable-logout',
        endpoints: {
          durableSignOut: createAuthEndpoint(
            '/durable-sign-out',
            { method: 'POST', requireHeaders: true },
            async (ctx) => {
              const token = await ctx.getSignedCookie(
                ctx.context.authCookies.sessionToken.name,
                ctx.context.secret,
              );
              if (token) {
                // A separate SELECT confirms the committed DELETE, including a retry after uncertain completion.
                await authPool.query(
                  'DELETE FROM auth.session WHERE token = $1',
                  [token],
                );
                const remaining = await authPool.query(
                  'SELECT 1 FROM auth.session WHERE token = $1',
                  [token],
                );
                if (remaining.rowCount !== 0) throw new Unavailable();
              }
              deleteSessionCookie(ctx);
              return ctx.json({ success: true });
            },
          ),
        },
      },
    ],
  });

export const IdentityLive = (settings: IdentitySettings) =>
  Layer.effect(
    AccessHttp,
    Effect.gen(function* () {
      const origin = new URL(settings.origin);
      const secure = origin.protocol === 'https:';
      if (
        origin.origin !== settings.origin ||
        settings.secret.length < 32 ||
        (!secure &&
          !(
            settings.loopbackDevelopment &&
            origin.protocol === 'http:' &&
            ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
          ))
      ) {
        return yield* Effect.fail(new Unavailable());
      }
      const authPool = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createPool(settings.authUrl, settings.maxConnections),
        ),
        (pool) =>
          Effect.promise(() => pool.end()).pipe(
            Effect.catchCause(() => Effect.void),
          ),
      );
      const privatePool = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createPool(settings.privateUrl, settings.maxConnections),
        ),
        (pool) =>
          Effect.promise(() => pool.end()).pipe(
            Effect.catchCause(() => Effect.void),
          ),
      );
      yield* Effect.tryPromise({
        try: async () => {
          await validateRole(authPool, 'sprout_auth');
          await validateRole(privatePool, 'sprout_api');
        },
        catch: () => new Unavailable(),
      });
      const auth = createIdentityAuth(settings, authPool);
      const Shell = shellOperations(privatePool);
      const Identity = {
        withRequest: <A, E>(
          request: Request,
          operation: Effect.Effect<A, E, RequestAccess>,
        ) =>
          Effect.gen(function* () {
            const session = yield* Effect.tryPromise({
              try: () =>
                auth.api.getSession({
                  headers: request.headers,
                  query: { disableCookieCache: true, disableRefresh: true },
                }),
              catch: () => new Unavailable(),
            });
            if (!session) return yield* Effect.fail(new Unauthenticated());
            return yield* operation.pipe(
              Effect.provideService(
                RequestAccess,
                requestAccess(
                  session.session.token,
                  session.user.id,
                  { name: session.user.name, email: session.user.email },
                  session.session.expiresAt,
                ),
              ),
            );
          }),
        read: (request: Request): Effect.Effect<Access> =>
          Identity.withRequest(
            request,
            Effect.gen(function* () {
              const access = yield* RequestAccess;
              return {
                kind: 'Authenticated' as const,
                owner: access.owner,
                expiresAt: access.expiresAt,
              };
            }),
          ).pipe(
            Effect.catch((error) =>
              Effect.succeed<Access>({
                kind:
                  error._tag === 'Unauthenticated'
                    ? 'Anonymous'
                    : 'Unavailable',
              }),
            ),
          ),
      };
      const handle = (request: Request) =>
        Effect.gen(function* () {
          const path = new URL(request.url).pathname;
          const key = `${request.method} ${path}`;
          if (
            ![
              'GET /api/session',
              'GET /api/shell',
              'PUT /api/settings/library-view',
              'POST /api/auth/sign-in/email',
              'POST /api/auth/sign-out',
            ].includes(key)
          )
            return json({ error: 'Not found' }, 404);
          if (
            request.method !== 'GET' &&
            (request.headers.get('origin') !== settings.origin ||
              request.headers.get('content-type')?.split(';')[0]?.trim() !==
                'application/json')
          )
            return json(
              { error: 'Invalid request origin or content type' },
              403,
            );
          if (key === 'GET /api/session') {
            const access = yield* Identity.read(request);
            return json(access, access.kind === 'Unavailable' ? 503 : 200);
          }
          if (key === 'POST /api/auth/sign-out') {
            return yield* Effect.tryPromise({
              try: async () => {
                const response = await auth.api.durableSignOut({
                  headers: request.headers,
                  asResponse: true,
                });
                if (!response.ok)
                  return json(
                    {
                      error:
                        'Sign out unavailable. Retry to revoke this session.',
                    },
                    503,
                  );
                return json(
                  { success: true },
                  200,
                  response.headers.getSetCookie(),
                );
              },
              catch: () => new Unavailable(),
            });
          }
          if (key === 'POST /api/auth/sign-in/email') {
            const body = yield* Effect.tryPromise({
              try: () => readJson(request),
              catch: (error) =>
                error instanceof PayloadTooLarge
                  ? error
                  : new Unauthenticated(),
            });
            const Credentials = Schema.Struct({
              email: Schema.String,
              password: Schema.String,
            });
            const credentials = yield* Effect.try({
              try: () => Schema.decodeUnknownSync(Credentials)(body),
              catch: () => new Unauthenticated(),
            });
            if (
              credentials.password.length > 128 ||
              credentials.email.length > 254
            )
              return json({ error: 'Invalid email or password' }, 401);
            const response = yield* Effect.tryPromise({
              try: () =>
                auth.handler(
                  new Request(`${settings.origin}/api/auth/sign-in/email`, {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      origin: settings.origin,
                    },
                    body: JSON.stringify({
                      email: credentials.email.trim().toLowerCase(),
                      password: credentials.password,
                      rememberMe: true,
                    }),
                    signal: request.signal,
                  }),
                ),
              catch: () => new Unavailable(),
            });
            if (!response.ok)
              return json(
                {
                  error:
                    response.status >= 500
                      ? 'Sign in unavailable. Retry shortly.'
                      : response.status === 429
                        ? 'Too many attempts. Try again shortly.'
                        : 'Invalid email or password',
                },
                response.status >= 500
                  ? 503
                  : response.status === 429
                    ? 429
                    : 401,
              );
            return json(
              { success: true },
              response.status,
              response.headers.getSetCookie(),
            );
          }
          if (key === 'GET /api/shell')
            return yield* Identity.withRequest(request, Shell.read()).pipe(
              Effect.map((summary) => json(summary)),
            );
          const body = yield* Effect.tryPromise({
            try: () => readJson(request),
            catch: (error) =>
              error instanceof PayloadTooLarge ? error : new Unauthenticated(),
          });
          const input = yield* Effect.try({
            try: () => Schema.decodeUnknownSync(SetLibraryView)(body),
            catch: () => new Unauthenticated(),
          });
          yield* Identity.withRequest(
            request,
            Shell.setLibraryView(input.libraryView),
          );
          return json({ success: true });
        }).pipe(
          Effect.catch((error) =>
            Effect.succeed(
              json(
                {
                  error:
                    error._tag === 'Unauthenticated'
                      ? 'Sign in required'
                      : error._tag === 'PayloadTooLarge'
                        ? 'Request body too large'
                        : 'Service unavailable. Retry shortly.',
                },
                error._tag === 'Unauthenticated'
                  ? 401
                  : error._tag === 'PayloadTooLarge'
                    ? 413
                    : 503,
              ),
            ),
          ),
        );
      return { handle };
    }),
  );
