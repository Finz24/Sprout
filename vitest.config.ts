import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    environment: 'node',
    pool: 'forks',
    testTimeout: 10000,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          maxWorkers: 1,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          // Backup quiesces this project's API and worker. Parallel files would
          // observe those stopped containers as connection failures.
          fileParallelism: false,
        },
      },
    ],
  },
});
