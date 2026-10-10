import { Schema } from 'effect';
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
export interface WorkspaceResponse {
  readonly owner: { readonly id: string; readonly name: string };
  readonly expiresAt: string;
  readonly items: readonly never[];
}
export const HealthApi = HttpApi.make('SproutHealth').add(
  HttpApiGroup.make('health').add(
    HttpApiEndpoint.get('live', '/health/live', { success: Live }),
    HttpApiEndpoint.get('ready', '/health/ready', {
      success: Ready,
      error: NotReady,
    }),
  ),
);
