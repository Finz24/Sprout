import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/database/src/schema.ts',
  out: './packages/database/migrations',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? 'postgresql://sprout@127.0.0.1:54329/sprout',
  },
  strict: true,
});
