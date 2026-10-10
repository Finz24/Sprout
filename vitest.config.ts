import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { conditions: ['development'] },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    testTimeout: 10000,
  },
});
