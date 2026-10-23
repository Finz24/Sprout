import { Data } from 'effect';
import { migrationsFolder, type DatabaseSettings } from '@sprout/database';
import type { ComponentName } from '@sprout/contracts';
import type { IdentitySettings } from '@sprout/database';

export class ConfigurationError extends Data.TaggedError('ConfigurationError')<{
  readonly setting: string;
}> {}
export interface Settings {
  readonly component: ComponentName;
  readonly port: number;
  readonly hostname: string;
  readonly database: DatabaseSettings;
  readonly identity?: IdentitySettings;
}
export function loadSettings(
  component: ComponentName,
  env: Record<string, string | undefined> = process.env,
): Settings {
  for (const name of [
    'MAINTENANCE_DATABASE_URL',
    'MIGRATION_DATABASE_URL',
    'POSTGRES_PASSWORD',
    'SPROUT_OWNER_PASSWORD',
    'SPROUT_OWNER_EMAIL',
    'SPROUT_OWNER_NAME',
  ]) {
    if (env[name])
      throw new ConfigurationError({ setting: 'SERVING_CREDENTIAL_BOUNDARY' });
  }
  if (
    component === 'worker' &&
    (env.AUTH_DATABASE_URL || env.BETTER_AUTH_SECRET || env.API_DATABASE_URL)
  )
    throw new ConfigurationError({ setting: 'WORKER_CREDENTIAL_BOUNDARY' });
  const parseInteger = (name: string, fallback: number, max: number) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new ConfigurationError({ setting: name });
    return value;
  };
  const url = env.DATABASE_URL ?? 'postgresql://sprout@127.0.0.1:54329/sprout';
  try {
    if (!['postgres:', 'postgresql:'].includes(new URL(url).protocol))
      throw new Error();
  } catch {
    throw new ConfigurationError({ setting: 'DATABASE_URL' });
  }
  return {
    component,
    port: parseInteger('PORT', component === 'api' ? 3001 : 3002, 65535),
    hostname: env.HOST ?? '127.0.0.1',
    database: {
      url,
      maxConnections: parseInteger(
        'DATABASE_POOL_SIZE',
        component === 'api' ? 5 : 3,
        20,
      ),
      migrationsFolder: migrationsFolder(),
      role: component === 'api' ? 'sprout_api' : 'sprout_worker',
    },
    ...(component === 'api'
      ? {
          identity: {
            authUrl: env.AUTH_DATABASE_URL ?? '',
            privateUrl: url,
            origin: env.SPROUT_ORIGIN ?? '',
            secret: env.BETTER_AUTH_SECRET ?? '',
            loopbackDevelopment: env.SPROUT_LOOPBACK_DEVELOPMENT === 'true',
            maxConnections: parseInteger('DATABASE_POOL_SIZE', 5, 20),
          },
        }
      : {}),
  };
}
