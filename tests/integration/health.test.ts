import { expect, test } from 'vitest';

const components = [
  { name: 'api', url: process.env.API_URL ?? 'http://127.0.0.1:3001' },
  { name: 'worker', url: process.env.WORKER_URL ?? 'http://127.0.0.1:3002' },
] as const;

test.each(components)('$name exposes liveness', async ({ name, url }) => {
  const response = await fetch(`${url}/health/live`, {
    signal: AbortSignal.timeout(5000),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'live', component: name });
});

test.each(components)(
  '$name declares all initialized dependencies ready',
  async ({ name, url }) => {
    const response = await fetch(`${url}/health/ready`, {
      signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ready',
      component: name,
      dependencies: {
        postgres: 'ready',
        migrations: 'ready',
        pgvector: 'ready',
      },
    });
  },
);
