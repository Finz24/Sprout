import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';

const eslint = new ESLint();

describe('workspace architecture policy', () => {
  test.each([
    {
      name: 'dynamic Node imports cannot enter the browser',
      file: 'apps/web/src/policy.ts',
      source: "export const fs = import('node:fs');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'dynamic database drivers cannot enter browser JavaScript',
      file: 'apps/web/src/policy.js',
      source: "export const pg = import('pg');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'dynamic deep imports cannot bypass public exports',
      file: 'apps/api/src/policy.ts',
      source: "export const config = import('@sprout/runtime/src/config.js');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'computed module paths cannot conceal dependencies',
      file: 'apps/web/src/policy.ts',
      source: 'export const load = (name: string) => import(name);',
      rule: 'no-restricted-syntax',
    },
    {
      name: 'CommonJS imports cannot bypass ESM checks',
      file: 'apps/web/src/policy.js',
      source: "export const fs = require('fs');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'web cannot import database infrastructure',
      file: 'apps/web/src/policy.ts',
      source: "import '@sprout/database';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'JavaScript cannot bring Node into the browser',
      file: 'apps/web/src/policy.js',
      source: "import 'node:fs';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'bare Node imports cannot enter contracts',
      file: 'packages/contracts/src/policy.ts',
      source: "import 'fs';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'inline import types cannot bypass dependency checks',
      file: 'apps/web/src/policy.ts',
      source: "export type Database = typeof import('@sprout/database');",
      rule: 'no-restricted-syntax',
    },
    {
      name: 'type declarations obey workspace boundaries',
      file: 'apps/web/src/policy.ts',
      source:
        "import type { Database } from '@sprout/database'; export type Value = Database;",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'deep imports cannot bypass public exports',
      file: 'apps/api/src/policy.ts',
      source: "import '@sprout/runtime/src/config.js';",
      rule: 'no-restricted-imports',
    },
    {
      name: 'relative paths cannot cross project boundaries',
      file: 'apps/web/src/policy.ts',
      source: "import '../../../packages/database/src/index.js';",
      rule: '@nx/enforce-module-boundaries',
    },
    {
      name: 'database cannot introduce a reverse dependency on runtime',
      file: 'packages/database/src/policy.ts',
      source: "import '@sprout/runtime';",
      rule: '@nx/enforce-module-boundaries',
    },
  ])('$name', async ({ file, source, rule }) => {
    const results = await eslint.lintText(source, { filePath: file });
    expect(
      results.flatMap((result) =>
        result.messages.map((message) => message.ruleId),
      ),
    ).toContain(rule);
  });

  test('web can use the public UI package', async () => {
    const results = await eslint.lintText("import '@sprout/ui';", {
      filePath: 'apps/web/src/policy.ts',
    });
    expect(results.flatMap((result) => result.messages)).toEqual([]);
  });
});
