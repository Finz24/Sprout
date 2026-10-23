import { Schema } from 'effect';

export const LibraryView = Schema.Literals(['grid', 'list']);
export type LibraryView = typeof LibraryView.Type;
export const OwnerSummary = Schema.Struct({ name: Schema.String, email: Schema.String });
export const Access = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('Anonymous') }),
  Schema.Struct({ kind: Schema.Literal('Authenticated'), owner: OwnerSummary, expiresAt: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('Unavailable') }),
]);
export type Access = typeof Access.Type;
export const ShellSummary = Schema.Struct({ owner: OwnerSummary, libraryView: LibraryView });
export type ShellSummary = typeof ShellSummary.Type;
export const SetLibraryView = Schema.Struct({ libraryView: LibraryView });
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from 'effect/http-api';

const Component = Schema.Literals(['api', 'worker']);
const Dependency = Schema.Literals([
  'ready',
  'unavailable',
  'missing',
  'not_checked',
]);
export const Dependencies = Schema.Struct({
  postgres: Dependency,
  migrations: Dependency,
  pgvector: Dependency,
});
export const Live = Schema.Struct({
  status: Schema.Literal('live'),
  component: Component,
});
export const Ready = Schema.Struct({
  status: Schema.Literal('ready'),
  component: Component,
  dependencies: Dependencies,
});
export const NotReady = Schema.Struct({
  status: Schema.Literal('not_ready'),
  component: Component,
  dependencies: Dependencies,
}).pipe(HttpApiSchema.status(503));
export type ComponentName = typeof Component.Type;
export type ReadyResponse = typeof Ready.Type;
export type NotReadyResponse = typeof NotReady.Type;
export const HealthApi = HttpApi.make('SproutHealth').add(
  HttpApiGroup.make('health').add(
    HttpApiEndpoint.get('live', '/health/live', { success: Live }),
    HttpApiEndpoint.get('ready', '/health/ready', {
      success: Ready,
      error: NotReady,
    }),
  ),
);
